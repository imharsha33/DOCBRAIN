import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, auth } from "@/integrations/firebase/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, HardDrive, MessageCircle, Layers, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { getUserDocuments } from "@/lib/document-storage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DocBrain AI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const uid = auth.currentUser?.uid || "guest-user";

  const stats = useQuery({
    queryKey: ["dashboard-stats", uid],
    queryFn: async () => {
      const userDocs = await getUserDocuments(uid);
      let convsSize = 0;
      let colsSize = 0;
      let totalQuestions = 0;

      try {
        const convsSnap = await getDocs(query(collection(db, "conversations"), where("user_id", "==", uid)));
        convsSize = convsSnap.size;
        for (const conv of convsSnap.docs) {
          const msgsSnap = await getDocs(
            query(collection(db, "messages"), where("conversation_id", "==", conv.id), where("role", "==", "user"))
          );
          totalQuestions += msgsSnap.size;
        }
      } catch {
        // Ignore
      }

      try {
        const colsSnap = await getDocs(query(collection(db, "collections"), where("user_id", "==", uid)));
        colsSize = colsSnap.size;
      } catch {
        // Ignore
      }

      let storageBytes = 0;
      userDocs.forEach((d) => {
        storageBytes += d.size_bytes ?? 0;
      });

      return {
        totalDocs: userDocs.length,
        totalChunks: 0,
        totalConvs: convsSize,
        totalQuestions,
        totalCollections: colsSize,
        storageBytes,
      };
    },
  });

  const recentDocs = useQuery({
    queryKey: ["recent-docs", uid],
    queryFn: async () => {
      const docs = await getUserDocuments(uid);
      return docs.slice(0, 5);
    },
  });

  const recentConvs = useQuery({
    queryKey: ["recent-convs", uid],
    queryFn: async () => {
      try {
        const snap = await getDocs(query(collection(db, "conversations"), where("user_id", "==", uid)));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as {
          id: string; title: string; updated_at: string;
        }[];
        items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        return items.slice(0, 5);
      } catch {
        return [];
      }
    },
  });

  const s = stats.data;
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your document intelligence workspace.</p>
        </div>
        <Button asChild>
          <Link to="/documents">Upload documents</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FileText className="h-4 w-4" />} label="Documents" value={s?.totalDocs ?? 0} />
        <StatCard icon={<HardDrive className="h-4 w-4" />} label="Storage used" value={formatBytes(s?.storageBytes ?? 0)} />
        <StatCard icon={<MessageCircle className="h-4 w-4" />} label="Questions asked" value={s?.totalQuestions ?? 0} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Collections" value={s?.totalCollections ?? 0} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent uploads</CardTitle>
            <Link to="/documents" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDocs.data?.length ? (
              recentDocs.data.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{d.status}</span>
                </div>
              ))
            ) : (
              <EmptyState label="No documents yet" cta={<Link to="/documents" className="text-brand">Upload one</Link>} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent conversations</CardTitle>
            <Link to="/chat" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Open chat <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentConvs.data?.length ? (
              recentConvs.data.map((c) => (
                <Link
                  key={c.id}
                  to="/chat"
                  search={{ id: c.id }}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="truncate">{c.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                  </span>
                </Link>
              ))
            ) : (
              <EmptyState label="No chats yet" cta={<Link to="/chat" className="text-brand">Start one</Link>} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label, cta }: { label: string; cta: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
      {label}. {cta}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
