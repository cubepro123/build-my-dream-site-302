import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Eye, Pencil, Plus, ImageOff } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, timeAgo } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { deleteListingFromIndex, reindexAllListings } from "@/lib/algolia.functions";
import { useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [{ title: "My listings — souqss" }] }),
  component: MyListings,
});

function MyListings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const algDelete = useServerFn(deleteListingFromIndex);
  const algReindex = useServerFn(reindexAllListings);
  const [reindexing, setReindexing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress(l: { id: string; title: string }) {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      // Haptic feedback if available
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      setConfirmDelete({ id: l.id, title: l.title });
    }, 500);
  }
  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
    setReindexing(true);
    try {
      const r: any = await algReindex({});
      toast.success(`Reindexed ${r?.count ?? 0} listings`);
    } catch (err: any) {
      toast.error(err.message ?? "Reindex failed");
    } finally {
      setReindexing(false);
    }
  }
  const { data: rows = [] } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  async function del(id: string) {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    algDelete({ data: { id } }).catch((err) => console.warn("algolia delete failed", err));
    toast.success("Listing deleted");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-3 pb-24 pt-4 sm:px-4 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-3xl">My listings</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{rows.length} {rows.length === 1 ? "ad" : "ads"}</p>
          </div>
          <Link to="/sell" className="hidden sm:block">
            <Button className="bg-[color:var(--ss-green)] hover:opacity-90"><Plus className="mr-1 h-4 w-4" /> New listing</Button>
          </Link>
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onReindex} disabled={reindexing} className="text-xs">
            {reindexing ? "Reindexing…" : "Reindex search"}
          </Button>
        </div>

        <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-8 text-center sm:p-10">
              <p className="font-semibold">You haven't posted anything yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Reach buyers all over South Sudan in minutes.</p>
              <Link to="/sell"><Button className="mt-4 bg-[color:var(--ss-green)] hover:opacity-90">Post your first listing</Button></Link>
            </div>
          ) : rows.map((l: any) => {
            const isSold = l.status && l.status !== "active";
            return (
              <div key={l.id} className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
                <div className="flex gap-3 p-3">
                  <Link to="/listings/$id" params={{ id: l.id }} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                    {l.images?.[0] ? (
                      <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-5 w-5" /></div>
                    )}
                    {isSold && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">Sold</span>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="min-w-0">
                      <Link to="/listings/$id" params={{ id: l.id }} className="block">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{l.title}</p>
                      </Link>
                      <p className="mt-0.5 truncate text-sm font-bold text-[color:var(--ss-green)]">{formatPrice(l.price, l.currency)}</p>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{l.location} • {timeAgo(l.created_at)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t bg-muted/30 text-sm">
                  <Link to="/listings/$id" params={{ id: l.id }} className="flex items-center justify-center gap-1.5 py-2.5 font-medium text-muted-foreground hover:bg-muted">
                    <Eye className="h-4 w-4" /> View
                  </Link>
                  <Link to="/edit/$id" params={{ id: l.id }} className="flex items-center justify-center gap-1.5 border-x py-2.5 font-medium text-[color:var(--ss-blue)] hover:bg-muted">
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                  <button onClick={() => del(l.id)} className="flex items-center justify-center gap-1.5 py-2.5 font-medium text-[color:var(--ss-red)] hover:bg-[color:var(--ss-red)]/5">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Mobile floating "New listing" button */}
      <Link to="/sell" className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--ss-green)] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-95 sm:hidden">
        <Plus className="h-5 w-5" /> New
      </Link>
    </div>
  );
}