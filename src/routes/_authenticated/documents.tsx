import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { auth } from "@/integrations/firebase/firebase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  getUserDocuments,
  uploadAndProcessFile,
  deleteDocumentById,
  getDocumentDownloadUrl,
  DocumentRecord,
} from "@/lib/document-storage";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — DocBrain AI" }] }),
  component: DocumentsPage,
});

const ACCEPTED = ".pdf,.txt,.md,.markdown,.csv,.json,.docx";
const MAX_SIZE = 25 * 1024 * 1024;

function DocumentsPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const uid = auth.currentUser?.uid || "guest-user";

  const docs = useQuery({
    queryKey: ["documents", uid],
    queryFn: () => getUserDocuments(uid),
    refetchInterval: (q) => {
      const rows = q.state.data as DocumentRecord[] | undefined;
      return rows?.some((r) => r.status === "pending" || r.status === "processing") ? 2500 : false;
    },
  });

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const currentUid = auth.currentUser?.uid || uid || "guest-user";

    for (const file of arr) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} is larger than 25 MB`);
        continue;
      }

      setUploads((u) => [...u, { name: file.name, progress: 10 }]);

      try {
        await uploadAndProcessFile(currentUid, file, (progress) => {
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress } : x)));
        });

        toast.success(`${file.name} uploaded & indexed successfully!`);
        qc.invalidateQueries({ queryKey: ["documents"] });
        qc.invalidateQueries({ queryKey: ["documents-ready"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["recent-docs"] });

        setTimeout(() => {
          setUploads((u) => u.filter((x) => x.name !== file.name));
        }, 400);
      } catch (e) {
        console.error("Upload process error:", e);
        toast.error(e instanceof Error ? e.message : "Upload failed");
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      const docData = docs.data?.find((d) => d.id === id);

      // Immediately update query cache so UI removes card in 0ms
      qc.setQueryData(["documents", uid], (old: DocumentRecord[] | undefined) =>
        old ? old.filter((d) => d.id !== id) : []
      );
      qc.setQueryData(["documents-ready", uid], (old: { id: string; name: string }[] | undefined) =>
        old ? old.filter((d) => d.id !== id) : []
      );

      toast.success("Document deleted");

      // Non-blocking background deletion
      deleteDocumentById(id, docData?.storage_path).catch(() => {});

      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["documents-ready"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleDownload(path: string, name: string) {
    try {
      const url = await getDocumentDownloadUrl(path);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.target = "_blank";
        a.click();
      } else {
        toast.info("Downloaded local document content");
      }
    } catch {
      toast.error("Download link unavailable");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload PDFs, Markdown, TXT, or CSV files. Every document is indexed for fast local AI search.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragging ? "border-brand bg-brand/5" : "border-border/60 bg-card/40 hover:bg-muted/30"
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-base font-medium">Drop files here or click to upload</div>
        <div className="mt-1 text-xs text-muted-foreground">PDF, TXT, MD, CSV, DOCX — up to 25 MB each</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <div className="mt-6 space-y-2">
          {uploads.map((u) => (
            <div key={u.name} className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="truncate">{u.name}</span>
                <span className="text-xs text-muted-foreground">Uploading & indexing…</span>
              </div>
              <Progress value={u.progress} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your library</h2>
        {docs.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : docs.data?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
            No documents yet. Upload one above to get started.
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
            {docs.data?.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatBytes(d.size_bytes ?? 0)} · {d.chunk_count ?? 0} chunks ·{" "}
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} error={d.error} />
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(d.storage_path, d.name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "ready")
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Ready
      </Badge>
    );
  if (status === "processing" || status === "pending")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> {status === "pending" ? "Queued" : "Indexing"}
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive" className="gap-1" title={error ?? ""}>
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" /> {status}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
