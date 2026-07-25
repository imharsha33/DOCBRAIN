import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db, auth } from "@/integrations/firebase/firebase";
import {
  collection, query, where, getDocs, setDoc, deleteDoc, doc, updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getOllamaConfig } from "./settings";
import {
  retrieveRelevantChunks,
  generateOllamaAnswer,
} from "@/lib/ollama-rag";
import {
  getUserDocuments,
  getAllUserChunks,
  getLocalConversations,
  saveLocalConversation,
  deleteLocalConversation,
  getLocalMessages,
  saveLocalMessage,
  ConversationRecord,
} from "@/lib/document-storage";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Chat — DocBrain AI" }] }),
  component: ChatPage,
});

type Citation = {
  documentId: string;
  documentName: string;
  page: number | null;
  chunkIndex: number;
  similarity: number;
  snippet: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[] | null;
  created_at: string;
};

function ChatPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: activeId } = useSearch({ from: "/_authenticated/chat" });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const uid = auth.currentUser?.uid || "guest-user";

  const conversations = useQuery({
    queryKey: ["conversations", uid],
    queryFn: async () => {
      const localConvs = getLocalConversations(uid);
      try {
        const snap = await getDocs(query(collection(db, "conversations"), where("user_id", "==", uid)));
        const remoteConvs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ConversationRecord[];
        const map = new Map<string, ConversationRecord>();
        localConvs.forEach((c) => map.set(c.id, c));
        remoteConvs.forEach((c) => map.set(c.id, c));
        const combined = Array.from(map.values());
        combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        return combined;
      } catch {
        localConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        return localConvs;
      }
    },
  });

  const documents = useQuery({
    queryKey: ["documents-ready", uid],
    queryFn: async () => {
      const userDocs = await getUserDocuments(uid);
      return userDocs
        .filter((d) => d.status === "ready")
        .map((d) => ({ id: d.id, name: d.name }));
    },
  });

  const messages = useQuery({
    queryKey: ["messages", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      if (!activeId) return [];
      const localMsgs = getLocalMessages(activeId) as unknown as MessageRow[];
      try {
        const snap = await getDocs(
          query(collection(db, "messages"), where("conversation_id", "==", activeId))
        );
        const remoteMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as MessageRow[];
        const map = new Map<string, MessageRow>();
        localMsgs.forEach((m) => map.set(m.id, m));
        remoteMsgs.forEach((m) => map.set(m.id, m));
        const combined = Array.from(map.values());
        combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return combined;
      } catch {
        localMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return localMsgs;
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data, pendingUser, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy || !uid) return;
    setInput("");
    setPendingUser(q);
    setBusy(true);

    try {
      let conversationId = activeId;
      const now = new Date().toISOString();

      // Create conversation if needed
      if (!conversationId) {
        conversationId = crypto.randomUUID();
        const convRecord: ConversationRecord = {
          id: conversationId,
          user_id: uid,
          title: q.slice(0, 60),
          document_ids: selectedDocs,
          updated_at: now,
          created_at: now,
        };
        saveLocalConversation(convRecord);
        setDoc(doc(db, "conversations", conversationId), convRecord).catch(() => {});
        navigate({ to: "/chat", search: { id: conversationId }, replace: true });
      }

      // Save user message
      const userMsg = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        user_id: uid,
        role: "user" as const,
        content: q,
        citations: null,
        created_at: now,
      };
      saveLocalMessage(userMsg);
      setDoc(doc(db, "messages", userMsg.id), userMsg).catch(() => {});

      // Add user message to query cache immediately
      const activeConvId = conversationId;
      qc.setQueryData(["messages", activeConvId], (old: MessageRow[] | undefined) => {
        const list = old ? [...old] : [];
        if (!list.some((m) => m.id === userMsg.id)) {
          list.push(userMsg as unknown as MessageRow);
        }
        return list;
      });

      // Retrieve Ollama Configuration
      const ollamaConfig = getOllamaConfig();

      let answer = "";
      let citationsList: Citation[] | null = null;

      // Fetch user's ready documents & chunks seamlessly
      const allChunks = await getAllUserChunks(uid, selectedDocs);

      // Retrieve top 5 relevant document chunks
      const relevantChunks = retrieveRelevantChunks(q, allChunks, 5);

      try {
        // Generate grounded answer using Ollama
        const result = await generateOllamaAnswer(q, relevantChunks, ollamaConfig);
        answer = result.answer;
        citationsList = result.citations.map((c, i) => ({
          documentId: c.documentId,
          documentName: c.documentName,
          page: null,
          chunkIndex: i,
          similarity: 1.0,
          snippet: c.snippet,
        }));
      } catch (ollamaErr) {
        answer = `**Ollama Model Connection Error:** ${
          ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr)
        }\n\nPlease check your Ollama server status and model configuration in [Settings](/settings).`;
      }

      // Save assistant message
      const assistantMsg: MessageRow = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        citations: citationsList,
        created_at: new Date().toISOString(),
      };
      saveLocalMessage({
        ...assistantMsg,
        conversation_id: activeConvId,
        user_id: uid,
        citations: citationsList as unknown as never,
      });

      // Update query cache immediately so UI renders answer instantly
      qc.setQueryData(["messages", activeConvId], (old: MessageRow[] | undefined) => {
        const list = old ? [...old] : [];
        if (!list.some((m) => m.id === assistantMsg.id)) {
          list.push(assistantMsg);
        }
        return list;
      });

      // Non-blocking Firestore save
      setDoc(doc(db, "messages", assistantMsg.id), {
        ...assistantMsg,
        conversation_id: activeConvId,
        user_id: uid,
      }).catch(() => {});

      // Update conversation timestamp
      const updatedConvTime = new Date().toISOString();
      const existingConv = conversations.data?.find((c) => c.id === activeConvId);
      if (existingConv) {
        saveLocalConversation({
          ...existingConv,
          user_id: uid,
          document_ids: existingConv.document_ids || [],
          updated_at: updatedConvTime,
        });
      }
      updateDoc(doc(db, "conversations", activeConvId), { updated_at: updatedConvTime }).catch(() => {});

      qc.invalidateQueries({ queryKey: ["messages", activeConvId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setBusy(false);
      setPendingUser(null);
    }
  }

  async function handleDelete(convId: string) {
    try {
      deleteLocalConversation(convId);

      // Immediately remove conversation and messages from query caches
      qc.setQueryData(["conversations", uid], (old: ConversationRecord[] | undefined) =>
        old ? old.filter((c) => c.id !== convId) : []
      );
      qc.removeQueries({ queryKey: ["messages", convId] });

      if (activeId === convId) {
        navigate({ to: "/chat", search: {}, replace: true });
      }

      toast.success("Conversation deleted");

      // Non-blocking Firestore cleanup
      (async () => {
        try {
          const msgsSnap = await getDocs(
            query(collection(db, "messages"), where("conversation_id", "==", convId))
          );
          for (const m of msgsSnap.docs) {
            deleteDoc(doc(db, "messages", m.id)).catch(() => {});
          }
          deleteDoc(doc(db, "conversations", convId)).catch(() => {});
        } catch {
          // Deleted locally
        }
      })();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 md:flex">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversations</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate({ to: "/chat", search: {} })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 pb-4">
            {conversations.data?.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                  activeId === c.id && "bg-muted/60",
                )}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => navigate({ to: "/chat", search: { id: c.id } })}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {conversations.data?.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                No conversations yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat pane */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/60 px-6 py-3">
          <DocumentFilter
            documents={documents.data ?? []}
            selected={selectedDocs}
            onChange={setSelectedDocs}
          />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {!activeId && !pendingUser && (
              <EmptyChat hasDocs={(documents.data?.length ?? 0) > 0} onPick={setInput} />
            )}
            {messages.data?.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/60 backdrop-blur-xl px-4 py-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card/50 p-2 focus-within:border-brand/60">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your documents…"
                className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button onClick={send} disabled={busy || !input.trim()} size="icon" className="shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">
              Answers are grounded in your uploaded documents.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageRow }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium",
          isUser ? "bg-brand text-white" : "bg-muted",
        )}
      >
        {isUser ? "You" : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", isUser ? "bg-brand/10" : "bg-card border border-border/60")}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.citations.map((c, i) => (
              <span
                key={i}
                title={c.snippet}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
              >
                <FileText className="h-3 w-3" />[{i + 1}] {c.documentName}
                {c.page ? ` · p.${c.page}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChat({ hasDocs, onPick }: { hasDocs: boolean; onPick: (s: string) => void }) {
  const suggestions = [
    "Summarize the key points across all my documents",
    "What are the main risks or concerns mentioned?",
    "Extract action items and deadlines",
    "Explain the most technical section like I'm 10",
  ];
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gradient-brand">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Ask your documents anything</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasDocs
          ? "Every answer is grounded in your uploaded files with clickable citations."
          : "Upload a document first, then chat with it."}
      </p>
      {hasDocs && (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left text-sm hover:border-brand/40"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentFilter({
  documents,
  selected,
  onChange,
}: {
  documents: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto text-xs">
      <span className="text-muted-foreground shrink-0">Scope:</span>
      <button
        onClick={() => onChange([])}
        className={cn(
          "rounded-full border px-2.5 py-1",
          selected.length === 0 ? "border-brand bg-brand/10 text-foreground" : "border-border/60 text-muted-foreground",
        )}
      >
        All documents
      </button>
      {documents.map((d) => {
        const on = selected.includes(d.id);
        return (
          <button
            key={d.id}
            onClick={() => onChange(on ? selected.filter((x) => x !== d.id) : [...selected, d.id])}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1",
              on ? "border-brand bg-brand/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {d.name}
          </button>
        );
      })}
      {documents.length === 0 && (
        <span className="text-muted-foreground">No indexed documents yet.</span>
      )}
    </div>
  );
}
