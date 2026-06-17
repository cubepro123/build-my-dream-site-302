import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, MapPin, MessageCircle, Store, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatPrice, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useFavoriteIds, useToggleFavorite } from "@/lib/favorites";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface ListingCardData {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  location: string;
  images: string[];
  created_at: string;
  category: string;
  seller_id?: string | null;
  boost_status?: string | null;
  boost_expires_at?: string | null;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const img = listing.images?.[0];
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: favIds } = useFavoriteIds();
  const toggle = useToggleFavorite();
  const isFav = !!favIds?.has(listing.id);
  const [opening, setOpening] = useState(false);

  function onFavClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate({ to: "/auth" });
    toggle.mutate({ listingId: listing.id, isFav });
  }

  async function onMessageClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate({ to: "/auth" });
    if (!listing.seller_id) return navigate({ to: "/listings/$id", params: { id: listing.id } });
    if (user.id === listing.seller_id) {
      toast.info("This is your own listing");
      return;
    }
    setOpening(true);
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("buyer_id", user.id)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id })
          .select("id")
          .single();
        if (error) throw error;
        convId = created.id;
      }
      navigate({ to: "/messages/$id", params: { id: convId! } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not open chat");
    } finally {
      setOpening(false);
    }
  }

  const isBoosted =
    listing.boost_status === "active" &&
    (!listing.boost_expires_at || new Date(listing.boost_expires_at).getTime() > Date.now());

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className={cn(
        "group relative block overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]",
        isBoosted && "boost-glow border-[color:var(--ss-gold)]/60",
      )}
    >
      {isBoosted && (
        <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-[color:var(--ss-gold)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent-foreground)] shadow">
          <Sparkles className="h-3 w-3" /> BOOSTED
        </span>
      )}
      <button
        type="button"
        aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
        onClick={onFavClick}
        className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur transition hover:scale-110 hover:bg-background"
      >
        <Heart
          className={cn(
            "h-4 w-4 transition",
            isFav ? "fill-[color:var(--ss-red)] text-[color:var(--ss-red)]" : "text-foreground/70",
          )}
        />
      </button>
      <div className="aspect-square w-full overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground text-sm">
            No photo
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{listing.title}</p>
        <p className="text-base font-bold text-[color:var(--ss-green)]">
          {formatPrice(listing.price, listing.currency)}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {listing.location}
          </span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
        {listing.seller_id && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate({ to: "/shop/$id", params: { id: listing.seller_id! } }); }}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[color:var(--ss-green)] hover:underline"
          >
            <Store className="h-3 w-3" /> View seller's shop
          </button>
        )}
        <button
          type="button"
          onClick={onMessageClick}
          disabled={opening}
          aria-label="Message seller"
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--ss-blue)] px-2 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          <MessageCircle className="h-3.5 w-3.5" /> {opening ? "Opening…" : "Message seller"}
        </button>
      </div>
    </Link>
  );
}