import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "My Favorites — souqss" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["favorites-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: favs, error } = await supabase
        .from("favorites")
        .select("listing_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (favs ?? []).map((f) => f.listing_id as string);
      if (ids.length === 0) return [];
      const { data: rows, error: e2 } = await supabase
        .from("listings")
        .select("id,title,price,currency,location,images,created_at,category,seller_id,boost_status,boost_expires_at")
        .in("id", ids)
        .eq("status", "active");
      if (e2) throw e2;
      // preserve order of favs
      const byId = new Map((rows ?? []).map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id)).filter(Boolean) as any[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Heart className="h-6 w-6 fill-[color:var(--ss-red)] text-[color:var(--ss-red)]" />
          <h1 className="text-2xl font-bold">My favorites</h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold">No favorites yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any listing to save it here.</p>
            <Link to="/"><Button className="mt-4 bg-[color:var(--ss-green)] hover:opacity-90">Browse listings</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l as any} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}