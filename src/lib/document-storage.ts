// DocBrain unified document storage & retrieval service
// Handles text extraction, Firestore storage, local fallback, and in-memory sorting (no composite index errors).

import { db, storage } from "@/integrations/firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, deleteObject, getDownloadURL } from "firebase/storage";
import { chunkDocumentText, DocChunk } from "./ollama-rag";

export type DocumentRecord = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  text_content: string;
  status: "ready" | "processing" | "pending" | "failed";
  chunk_count: number;
  page_count: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const LOCAL_DOCS_KEY = "docbrain_local_documents_v1";
const LOCAL_CHUNKS_KEY = "docbrain_local_chunks_v1";

// Local Storage Fallback Helpers
function getLocalDocuments(uid: string): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as DocumentRecord[];
    return all.filter((d) => d.user_id === uid);
  } catch {
    return [];
  }
}

function saveLocalDocument(docRecord: DocumentRecord) {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    const all = raw ? (JSON.parse(raw) as DocumentRecord[]) : [];
    const existingIndex = all.findIndex((d) => d.id === docRecord.id);
    if (existingIndex >= 0) {
      all[existingIndex] = docRecord;
    } else {
      all.push(docRecord);
    }
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("LocalStorage save warning:", e);
  }
}

function deleteLocalDocument(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    if (!raw) return;
    const all = (JSON.parse(raw) as DocumentRecord[]).filter((d) => d.id !== id);
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(all));

    const chunksRaw = localStorage.getItem(LOCAL_CHUNKS_KEY);
    if (chunksRaw) {
      const allChunks = (JSON.parse(chunksRaw) as (DocChunk & { documentId: string })[]).filter(
        (c) => c.documentId !== id
      );
      localStorage.setItem(LOCAL_CHUNKS_KEY, JSON.stringify(allChunks));
    }
  } catch (e) {
    console.warn("LocalStorage delete warning:", e);
  }
}

function saveLocalChunks(documentId: string, chunks: DocChunk[]) {
  try {
    const raw = localStorage.getItem(LOCAL_CHUNKS_KEY);
    const all = raw ? (JSON.parse(raw) as DocChunk[]) : [];
    const filtered = all.filter((c) => c.documentId !== documentId);
    filtered.push(...chunks);
    localStorage.setItem(LOCAL_CHUNKS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn("LocalStorage save chunks warning:", e);
  }
}

function getLocalChunks(documentId: string): DocChunk[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHUNKS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as DocChunk[];
    return all.filter((c) => c.documentId === documentId);
  } catch {
    return [];
  }
}

/**
 * Text extraction from multiple file types (PDF, TXT, MD, CSV, JSON, DOCX, etc.)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const nameLower = file.name.toLowerCase();

  // Plain text formats
  if (
    file.type.startsWith("text/") ||
    nameLower.endsWith(".txt") ||
    nameLower.endsWith(".md") ||
    nameLower.endsWith(".markdown") ||
    nameLower.endsWith(".csv") ||
    nameLower.endsWith(".json") ||
    nameLower.endsWith(".html") ||
    nameLower.endsWith(".xml") ||
    nameLower.endsWith(".yaml") ||
    nameLower.endsWith(".yml")
  ) {
    try {
      const text = await file.text();
      if (text && text.trim().length > 0) {
        return text.slice(0, 250000);
      }
    } catch {
      // Fallback below
    }
  }

  // PDF text extraction using unpdf with fallback
  if (file.type === "application/pdf" || nameLower.endsWith(".pdf")) {
    try {
      const buffer = await file.arrayBuffer();
      const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await unpdfExtract(pdf, { mergePages: true });
      const fullText = Array.isArray(text) ? text.join("\n\n") : String(text || "");
      if (fullText.trim().length > 30) {
        return fullText.slice(0, 250000);
      }
    } catch (unpdfErr) {
      console.warn("unpdf extraction note:", unpdfErr);
    }
  }

  // Universal text stream / ASCII string extractor fallback for binary streams
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let str = "";

    for (let i = 0; i < bytes.length && str.length < 180000; i++) {
      const char = bytes[i];
      if ((char >= 32 && char <= 126) || char === 10 || char === 13 || char === 9) {
        str += String.fromCharCode(char);
      } else if (str.length > 0 && str[str.length - 1] !== " ") {
        str += " ";
      }
    }

    const cleaned = str
      .replace(/\/[\w]+/g, " ")
      .replace(/\b(obj|endobj|stream|endstream|xref|trailer|startxref)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.length > 20
      ? cleaned
      : `${file.name} - Uploaded document content (${file.size} bytes).`;
  } catch {
    return `${file.name} - Uploaded document.`;
  }
}

/**
 * Fetch user documents sorted by created_at desc without triggering Firestore composite index errors
 */
export async function getUserDocuments(uid: string): Promise<DocumentRecord[]> {
  const localDocs = getLocalDocuments(uid);
  try {
    // Note: Querying without orderBy on created_at avoids Firestore composite index requirement!
    const snap = await getDocs(query(collection(db, "documents"), where("user_id", "==", uid)));
    const remoteDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentRecord[];

    // Merge remote and local documents
    const map = new Map<string, DocumentRecord>();
    localDocs.forEach((d) => map.set(d.id, d));
    remoteDocs.forEach((d) => map.set(d.id, d));

    const combined = Array.from(map.values());
    combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return combined;
  } catch (e) {
    console.warn("Firestore getUserDocuments fallback to local:", e);
    localDocs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return localDocs;
  }
}

/**
 * Upload and process a single file, guaranteeing instant index & availability
 */
export async function uploadAndProcessFile(
  uid: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<DocumentRecord> {
  const docId = crypto.randomUUID();
  const storageKey = `${uid}/${docId}-${file.name}`;
  const now = new Date().toISOString();

  onProgress?.(20);

  // 1. Text Extraction
  const textContent = await extractTextFromFile(file);
  onProgress?.(50);

  // 2. Chunk text
  const chunks = chunkDocumentText(docId, file.name, textContent);
  onProgress?.(70);

  // 3. Attempt optional storage upload without hanging
  try {
    const storageRef = ref(storage, `documents/${storageKey}`);
    const storagePromise = uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Storage timeout")), 1200)
    );
    await Promise.race([storagePromise, timeoutPromise]);
  } catch {
    // Non-blocking storage note
  }

  const docRecord: DocumentRecord = {
    id: docId,
    user_id: uid,
    name: file.name,
    storage_path: storageKey,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    text_content: textContent.slice(0, 180000),
    status: "ready",
    chunk_count: Math.max(1, chunks.length),
    page_count: null,
    error: null,
    created_at: now,
    updated_at: now,
  };

  // 4. Save to Local Storage immediately for instant 0ms availability
  saveLocalDocument(docRecord);
  saveLocalChunks(docId, chunks);
  onProgress?.(100);

  // 5. Perform Storage and Firestore sync in background without blocking the UI upload call
  (async () => {
    try {
      const storageRef = ref(storage, `documents/${storageKey}`);
      await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
    } catch {
      // Background storage note
    }

    try {
      await setDoc(doc(db, "documents", docId), docRecord);
      const topChunks = chunks.slice(0, 20);
      await Promise.all(
        topChunks.map((c) =>
          addDoc(collection(db, "documents", docId, "chunks"), {
            user_id: uid,
            document_id: docId,
            document_name: file.name,
            chunk_index: c.chunkIndex,
            content: c.text,
            created_at: now,
          }).catch(() => {})
        )
      );
    } catch {
      // Background firestore note
    }
  })();

  return docRecord;
}

/**
 * Delete document from Firestore and local storage
 */
export async function deleteDocumentById(id: string, storagePath?: string): Promise<void> {
  deleteLocalDocument(id);

  if (storagePath) {
    try {
      const storageRef = ref(storage, `documents/${storagePath}`);
      await deleteObject(storageRef);
    } catch {
      // Ignore storage delete errors
    }
  }

  try {
    await deleteDoc(doc(db, "documents", id));
  } catch {
    // Ignore Firestore delete errors
  }
}

/**
 * Download file link
 */
export async function getDocumentDownloadUrl(storagePath: string): Promise<string | null> {
  try {
    const storageRef = ref(storage, `documents/${storagePath}`);
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

/**
 * Get all document chunks for RAG context building
 */
export async function getAllUserChunks(uid: string, documentIds?: string[]): Promise<DocChunk[]> {
  const docs = await getUserDocuments(uid);
  const targetDocs = documentIds && documentIds.length > 0
    ? docs.filter((d) => documentIds.includes(d.id))
    : docs;

  const allChunks: DocChunk[] = [];

  for (const d of targetDocs) {
    if (d.text_content && d.text_content.length > 10) {
      const chunks = chunkDocumentText(d.id, d.name, d.text_content);
      allChunks.push(...chunks);
    } else {
      const localChunks = getLocalChunks(d.id);
      if (localChunks.length > 0) {
        allChunks.push(...localChunks);
      } else {
        try {
          const snap = await getDocs(collection(db, "documents", d.id, "chunks"));
          snap.docs.forEach((cDoc) => {
            const data = cDoc.data();
            if (data.content) {
              allChunks.push({
                documentId: d.id,
                documentName: d.name,
                text: data.content,
                chunkIndex: data.chunk_index ?? 0,
              });
            }
          });
        } catch {
          // Ignore
        }
      }
    }
  }

  return allChunks;
}

export type ConversationRecord = {
  id: string;
  user_id: string;
  title: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: unknown;
  created_at: string;
};

const LOCAL_CONVS_KEY = "docbrain_local_conversations_v1";
const LOCAL_MSGS_KEY = "docbrain_local_messages_v1";

export function getLocalConversations(uid: string): ConversationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as ConversationRecord[];
    return all.filter((c) => c.user_id === uid);
  } catch {
    return [];
  }
}

export function saveLocalConversation(conv: ConversationRecord) {
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY);
    const all = raw ? (JSON.parse(raw) as ConversationRecord[]) : [];
    const idx = all.findIndex((c) => c.id === conv.id);
    if (idx >= 0) all[idx] = conv;
    else all.push(conv);
    localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Save local conv warning:", e);
  }
}

export function deleteLocalConversation(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY);
    if (!raw) return;
    const all = (JSON.parse(raw) as ConversationRecord[]).filter((c) => c.id !== id);
    localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(all));

    const msgsRaw = localStorage.getItem(LOCAL_MSGS_KEY);
    if (msgsRaw) {
      const allMsgs = (JSON.parse(msgsRaw) as MessageRecord[]).filter((m) => m.conversation_id !== id);
      localStorage.setItem(LOCAL_MSGS_KEY, JSON.stringify(allMsgs));
    }
  } catch (e) {
    console.warn("Delete local conv warning:", e);
  }
}

export function getLocalMessages(convId: string): MessageRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_MSGS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as MessageRecord[];
    return all.filter((m) => m.conversation_id === convId);
  } catch {
    return [];
  }
}

export function saveLocalMessage(msg: MessageRecord) {
  try {
    const raw = localStorage.getItem(LOCAL_MSGS_KEY);
    const all = raw ? (JSON.parse(raw) as MessageRecord[]) : [];
    const idx = all.findIndex((m) => m.id === msg.id);
    if (idx >= 0) all[idx] = msg;
    else all.push(msg);
    localStorage.setItem(LOCAL_MSGS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Save local message warning:", e);
  }
}

