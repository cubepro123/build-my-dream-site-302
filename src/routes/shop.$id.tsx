import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, Phone, Store, Briefcase, Clock, Circle, ChevronRight, CalendarCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { MapView } from "@/components/MapView";

export const Route = createFileRoute("/shop/$id")({
  head: () => ({ meta: [{ title: "Shop — souqss" }] }),
  component: ShopPage,
});

function initialsOf(name?: string | null) {
  if (!name) return "S";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "S";
}

function ShopPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "asc" | "desc">("recent");
  const [booking, setBooking] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const [comment, setComment] = useState("");
  const [savingRating, setSavingRating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["shop", id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, location, phone, whatsapp, created_at, shop_name, shop_bio, shop_logo_url, shop_type, shop_lat, shop_lng, shop_address")
        .eq("id", id)
        .maybeSingle();
      if (!profile) return null;
      const { data: listings } = await supabase
        .from("listings")
        .select("id, title, price, currency, location, images, created_at, category, seller_id")
        .eq("seller_id", profile.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return { profile, listings: listings ?? [] };
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["ratings", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("seller_ratings")
        .select("id, stars, comment, rater_id, created_at")
        .eq("seller_id", id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{ id: string; stars: number; comment: string | null; rater_id: string; created_at: string }>;
    },
  });

  const ratingStats = useMemo(() => {
    const arr = ratings ?? [];
    if (!arr.length) return { avg: 0, count: 0 };
    const sum = arr.reduce((s, r) => s + r.stars, 0);
    return { avg: sum / arr.length, count: arr.length };
  }, [ratings]);

  const myRating = useMemo(() => ratings?.find((r) => r.rater_id === user?.id) ?? null, [ratings, user]);
  const [myStars, setMyStars] = useState<number>(0);

  // sync local input from server when loaded
  useMemo(() => {
    if (myRating) {
      setMyStars(myRating.stars);
      if (!comment) setComment(myRating.comment ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRating?.id]);

  async function saveRating() {
    if (!user) return navigate({ to: "/auth" });
    if (user.id === id) return toast.info("You can't rate your own shop");
    if (!myStars) return toast.error("Pick 1–5 stars first");
    setSavingRating(true);
    try {
      const { error } = await (supabase as any)
        .from("seller_ratings")
        .upsert(
          { rater_id: user.id, seller_id: id, stars: myStars, comment: comment.trim() || null },
          { onConflict: "rater_id,seller_id" },
        );
      if (error) throw error;
      toast.success(myRating ? "Rating updated" : "Thanks for your rating!");
      qc.invalidateQueries({ queryKey: ["ratings", id] });
    } catch (err: any) {
      toast.error(err.message ?? "Could not save rating");
    } finally {
      setSavingRating(false);
    }
  }

  const allListings = (data?.listings ?? []) as any[];
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of allListings) if (l.category) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allListings]);

  const filtered = useMemo(() => {
    const f = cat === "all" ? allListings : allListings.filter((l) => l.category === cat);
    const s = [...f];
    if (sort === "asc") s.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === "desc") s.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return s;
  }, [allListings, cat, sort]);

  if (isLoading) {
    return <div className="min-h-screen bg-[#f5f6f8] p-8 text-center text-muted-foreground">Loading shop…</div>;
  }
  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] p-8 text-center">
        <p className="font-semibold">Shop not found</p>
        <Link to="/" className="mt-3 inline-block text-[color:var(--ss-green)] hover:underline">Back home</Link>
      </div>
    );
  }

  const profile = (data as any).profile;
  const displayName = profile.shop_name || profile.full_name || "South Sudan Seller";
  const isOwner = user?.id === profile.id;
  const memberSince = profile.created_at ? new Date(profile.created_at) : null;
  const yearsActive = memberSince ? Math.max(0, Math.floor((Date.now() - memberSince.getTime()) / (365 * 24 * 3600 * 1000))) : 0;
  const typeLabel = profile.shop_type === "services" ? "Service Provider" : profile.shop_type === "marketplace" ? "Marketplace Seller" : null;

  async function bookProvider() {
    if (!user) return navigate({ to: "/auth" });
    if (user.id === profile.id) return toast.info("This is your own shop");
    const listing = allListings[0];
    if (!listing) { toast.error("This provider has no active listings yet"); return; }
    setBooking(true);
    try {
      const { data: existing } = await supabase
        .from("conversations").select("id")
        .eq("listing_id", listing.id).eq("buyer_id", user.id).maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: profile.id })
          .select("id").single();
        if (error) throw error;
        convId = created.id;
      }
      const body = `📅 Booking request\n\nHey! I saw your booking on souqss and would like to book your service. Where would you like us to come and what service are you seeking?`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId, sender_id: user.id, body,
      });
      if (msgErr) throw msgErr;
      toast.success("Booking sent — opening chat");
      navigate({ to: "/messages/$id", params: { id: convId! } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not send booking");
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] pb-10">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
              else navigate({ to: "/" });
            }}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-semibold sm:text-lg">{displayName}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 space-y-3 lg:w-[240px]">
            <div className="rounded-xl border bg-card p-5 text-center shadow-sm">
              <div className="mx-auto mb-3 grid h-20 w-20 place-items-center overflow-hidden rounded-full border-[3px] border-[#e8c84a] bg-[#1a1a1a] text-[#e8c84a]">
                {profile.shop_logo_url ? (
                  <img src={profile.shop_logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-medium">{initialsOf(displayName)}</span>
                )}
              </div>
              <div className="text-[15px] font-medium">{displayName}</div>
              {typeLabel && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  {profile.shop_type === "services" ? <Briefcase className="h-3 w-3" /> : <Store className="h-3 w-3" />} {typeLabel}
                </div>
              )}
              <div className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {yearsActive > 0 ? `${yearsActive}+ years active` : "New seller"}
              </div>
              <div className="text-[12px] text-muted-foreground">
                <Circle className="mr-1 inline h-2 w-2 fill-[#22c55e] text-[#22c55e]" />
                Last seen recently
              </div>
              {!isOwner ? (
                <div className="mt-3 space-y-2">
                  {profile.shop_type === "services" && (
                    <button
                      onClick={bookProvider}
                      disabled={booking}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#22c55e] text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      <CalendarCheck className="h-3.5 w-3.5" /> {booking ? "Sending…" : "Book service"}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={profile.phone ? `tel:${profile.phone}` : undefined}
                      onClick={(e) => { if (!profile.phone) { e.preventDefault(); } }}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-md text-xs font-medium ${profile.phone ? "bg-[#22c55e] text-white hover:opacity-90" : "bg-muted text-muted-foreground"}`}
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                    <button
                      onClick={() => navigate({ to: "/messages" })}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-md border bg-card text-xs font-medium hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Chat
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  to="/profile"
                  className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border text-xs font-medium hover:bg-muted"
                >
                  Edit shop
                </Link>
              )}
            </div>

            {profile.location && (
              <div className="rounded-xl border bg-card p-3 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.location}</span>
                </div>
              </div>
            )}

            {profile.shop_lat != null && profile.shop_lng != null && (
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shop location</div>
                <MapView lat={profile.shop_lat} lng={profile.shop_lng} address={profile.shop_address} label={displayName} />
              </div>
            )}

            {profile.shop_bio && (
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">About this shop</div>
                <p className="text-[13px] leading-relaxed text-foreground/80">{profile.shop_bio}</p>
              </div>
            )}

            {/* Ratings */}
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ratings</div>
                <div className="flex items-center gap-1 text-[12px] font-semibold">
                  <Star className="h-3.5 w-3.5 fill-[#f5a623] text-[#f5a623]" />
                  {ratingStats.count > 0 ? ratingStats.avg.toFixed(1) : "—"}
                  <span className="font-normal text-muted-foreground">({ratingStats.count})</span>
                </div>
              </div>
              {!isOwner && user && (
                <>
                  <div className="mb-2 flex items-center gap-1" onMouseLeave={() => setHoverStar(0)}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const lit = (hoverStar || myStars) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHoverStar(n)}
                          onClick={() => setMyStars(n)}
                          className="p-0.5"
                          aria-label={`${n} stars`}
                        >
                          <Star className={`h-5 w-5 ${lit ? "fill-[#f5a623] text-[#f5a623]" : "text-muted-foreground/40"}`} />
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Share your experience (optional)"
                    className="mb-2 w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-[12px] outline-none"
                  />
                  <button
                    onClick={saveRating}
                    disabled={savingRating || !myStars}
                    className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#22c55e] text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {savingRating ? "Saving…" : myRating ? "Update rating" : "Submit rating"}
                  </button>
                </>
              )}
              {!user && !isOwner && (
                <Link to="/auth" className="text-[12px] text-[color:var(--ss-green)] hover:underline">
                  Sign in to rate this shop
                </Link>
              )}
              {(ratings?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {ratings!.slice(0, 5).map((r) => (
                    <div key={r.id} className="text-[12px]">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3 w-3 ${r.stars >= n ? "fill-[#f5a623] text-[#f5a623]" : "text-muted-foreground/30"}`}
                          />
                        ))}
                        <span className="ml-1 text-muted-foreground">{timeAgo(r.created_at)}</span>
                      </div>
                      {r.comment && <p className="mt-0.5 text-foreground/80">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Main */}
          <section className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => setCat("all")}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${cat === "all" ? "border-[#22c55e] bg-[#22c55e] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                All ({allListings.length})
              </button>
              {categories.map(([c, n]) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${cat === c ? "border-[#22c55e] bg-[#22c55e] text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
                >
                  {c} ({n})
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "listing" : "listings"}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="rounded-md border bg-card px-2.5 py-1.5 text-xs"
              >
                <option value="recent">Newest first</option>
                <option value="asc">Price: Low to High</option>
                <option value="desc">Price: High to Low</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
                {isOwner ? "You haven't posted any ads yet." : "This shop has no active ads."}
                {isOwner && (
                  <div className="mt-3">
                    <Link to="/sell" className="inline-flex items-center gap-1 rounded-md bg-[#22c55e] px-4 py-2 text-xs font-medium text-white hover:opacity-90">
                      Post an ad <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((l) => (
                  <Link
                    key={l.id}
                    to="/listings/$id"
                    params={{ id: l.id }}
                    className="group overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20"
                  >
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {l.images?.[0] ? (
                        <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-[14px] font-medium text-[#22c55e]">{formatPrice(l.price, l.currency)}</div>
                      <div className="line-clamp-2 min-h-[34px] text-[12px] leading-snug text-foreground">{l.title}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> <span className="truncate">{l.location ?? "—"}</span>
                        <span className="ml-auto shrink-0">{timeAgo(l.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}