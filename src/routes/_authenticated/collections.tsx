import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db, auth } from "@/integrations/firebase/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/collections")({
  head: () => ({ meta: [{ title: "Collections — DocBrain AI" }] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const uid = auth.currentUser?.uid || "guest-user";

  const collections = useQuery({
    queryKey: ["collections", uid],
    queryFn: async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "collections"), where("user_id", "==", uid))
        );
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as {
          id: string; name: string; description: string | null; created_at: string;
        }[];
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return items;
      } catch {
        return [];
      }
    },
  });

  async function create() {
    if (!name.trim() || !uid) return;
    try {
      await addDoc(collection(db, "collections"), {
        name: name.trim(),
        user_id: uid,
        description: null,
        created_at: new Date().toISOString(),
      });
      setName("");
      qc.invalidateQueries({ queryKey: ["collections"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create collection");
    }
  }

  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, "collections", id));
      qc.invalidateQueries({ queryKey: ["collections"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Group documents by topic, class, or client to focus your searches.
      </p>

      <div className="mt-8 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name…"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} className="gap-2">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.data?.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FolderKanban className="h-4 w-4 text-brand" /> {c.name}
                </div>
                {c.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                )}
              </div>
              <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
        {collections.data?.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
            No collections yet. Create your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
