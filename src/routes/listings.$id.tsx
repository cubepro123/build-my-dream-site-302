import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, PhoneCall, MessageCircle, ArrowLeft, ShieldCheck, ChevronLeft, ChevronRight, Share2, Store, ChevronDown, ChevronUp, Flag, Camera, User, Pencil, Trash2, CalendarCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, timeAgo, telLink, waLink } from "@/lib/format";
import { ListingCard } from "@/components/ListingCard";
import { MapView } from "@/components/MapView";
import { BoostModal } from "@/components/BoostModal";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { incrementBoostView } from "@/lib/boost.functions";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({ meta: [{ title: "Listing — souqss" }] }),
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: flags } = useFeatureFlags();
  const [activeImg, setActiveImg] = useState(0);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [callbackSending, setCallbackSending] = useState(false);
  const [booking, setBooking] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id, user?.id ?? "anon"],
    queryFn: async () => {
      const cols = user
        ? "id, seller_id, title, description, price, currency, category, condition, location, listing_lat, listing_lng, listing_address, images, status, created_at, updated_at, phone, whatsapp, boost_status, boost_views_purchased, boost_views_delivered, boost_expires_at"
        : "id, seller_id, title, description, price, currency, category, condition, location, listing_lat, listing_lng, listing_address, images, status, created_at, updated_at, boost_status, boost_views_purchased, boost_views_delivered, boost_expires_at";
      const { data: listingRaw, error } = await supabase
        .from("listings")
        .select(cols)
        .eq("id", id)
        .maybeSingle();
      const listing = listingRaw as any;
      if (error) throw error;
      if (!listing) return null;
      const { data: seller } = await supabase
        .from("profiles")
        .select("id, full_name, phone, whatsapp, location, created_at, shop_type, shop_name, shop_lat, shop_lng, shop_address")
        .eq("id", listing.seller_id)
        .maybeSingle();
      return { listing, seller };
    },
  });

  // Count a boost view (once per page load, non-owners only, active boost)
  useEffect(() => {
    if (!data?.listing) return;
    if (user && user.id === data.listing.seller_id) return;
    if (data.listing.boost_status !== "active") return;
    incrementBoostView({ data: { listing_id: data.listing.id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.listing?.id]);

  async function startConversation() {
    if (!user) return navigate({ to: "/auth" });
    if (!data?.listing) return;
    if (user.id === data.listing.seller_id) return toast.info("This is your own listing");
    setSending(true);
    try {
      const convId = await ensureConversation();
      const body = msg.trim() || `Hi! Is "${data.listing.title}" still available?`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        body,
      });
      if (msgErr) throw msgErr;
      navigate({ to: "/messages/$id", params: { id: convId } });
      setMsgOpen(false);
      setMsg("");
      toast.success("Message sent to seller");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function ensureConversation(): Promise<string> {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", data!.listing.id)
      .eq("buyer_id", user!.id)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        listing_id: data!.listing.id,
        buyer_id: user!.id,
        seller_id: data!.listing.seller_id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  }

  async function requestCallback() {
    if (!user) return navigate({ to: "/auth" });
    if (!data?.listing) return;
    if (user.id === data.listing.seller_id) return toast.info("This is your own listing");
    setCallbackSending(true);
    try {
      const convId = await ensureConversation();
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name, phone, whatsapp")
        .eq("id", user.id)
        .maybeSingle();
      const contact = me?.phone || me?.whatsapp || user.email || "(no phone on profile)";
      const name = me?.full_name || user.email || "A buyer";
      const body =
        `📞 Callback request\n\n${name} is interested in your ad "${data.listing.title}" on souqss and would like you to call them back.\n\nContact: ${contact}`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        body,
      });
      if (msgErr) throw msgErr;
      toast.success("Callback request sent to the seller");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send callback request");
    } finally {
      setCallbackSending(false);
    }
  }

  async function bookService() {
    if (!user) return navigate({ to: "/auth" });
    if (!data?.listing) return;
    if (user.id === data.listing.seller_id) return toast.info("This is your own listing");
    setBooking(true);
    try {
      const convId = await ensureConversation();
      const body = `📅 Booking request\n\nHey! I saw your booking on souqss for "${data!.listing.title}". Where would you like us to meet and what service are you seeking?`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        body,
      });
      if (msgErr) throw msgErr;
      toast.success("Booking sent — opening chat");
      navigate({ to: "/messages/$id", params: { id: convId } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not send booking");
    } finally {
      setBooking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <MiniBar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading listing…</div>
      </div>
    );
  }

  if (!data?.listing) {
    return (
      <div className="min-h-screen bg-muted/30">
        <MiniBar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-semibold">Listing not found</p>
          <Link to="/"><Button className="mt-4">Back home</Button></Link>
        </div>
      </div>
    );
  }

  const { listing, seller } = data;
  const isOwner = !!user && user.id === listing.seller_id;
  const phone = (listing as any).phone || seller?.phone;
  const whatsapp = (listing as any).whatsapp || seller?.whatsapp;
  const images: string[] = listing.images?.length ? listing.images : [];
  const total = images.length;

  function prev() { setActiveImg((i) => (i - 1 + total) % total); }
  function next() { setActiveImg((i) => (i + 1) % total); }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  }

  async function deleteListing() {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) return toast.error(error.message);
    toast.success("Listing deleted");
    navigate({ to: "/my-listings" });
  }

  return (
    <div className="min-h-screen bg-[#eef3f9]">
      <MiniBar onShare={share} />
      <main className="mx-auto max-w-6xl px-3 py-3">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-2.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="text-[color:var(--ss-green)] hover:underline">All ads</Link>
          <span>/</span>
          <Link to="/" className="text-[color:var(--ss-green)] hover:underline">{listing.category}</Link>
          <span>/</span>
          <span className="truncate">{listing.title}</span>
        </nav>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* LEFT column */}
          <div className="flex flex-col gap-2.5">
            {/* Gallery card */}
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="relative h-[320px] w-full bg-neutral-100 sm:h-[440px] lg:h-[520px]">
                {images[activeImg] ? (
                  <img src={images[activeImg]} alt={listing.title} className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm text-neutral-400">Product image</div>
                )}
                {total > 1 && (
                  <>
                    <button onClick={prev} aria-label="Previous" className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={next} aria-label="Next" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">
                  <Camera className="h-3 w-3" /> {Math.max(activeImg + 1, 1)}/{Math.max(total, 1)}
                </span>
              </div>
              {total > 1 && (
                <div className="flex gap-1.5 bg-card p-2">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setActiveImg(i)} className={`h-[60px] w-[60px] shrink-0 overflow-hidden rounded-md border-2 ${i === activeImg ? "border-[color:var(--ss-green)]" : "border-transparent"}`}>
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title + attributes card */}
            <div className="rounded-lg border bg-card px-4 py-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium capitalize text-amber-700">
                  {listing.status || "Listed"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {listing.location}, {timeAgo(listing.created_at)}
                </span>
              </div>
              <h1 className="mb-3 text-xl font-medium leading-snug text-foreground">{listing.title}</h1>
              <div className="grid grid-cols-2">
                <Attr label="Category" value={listing.category} />
                <Attr label="Condition" value={listing.condition} />
                <Attr label="Location" value={listing.location} />
                <Attr label="Currency" value={listing.currency} />
              </div>
            </div>

            {/* Store + description + show contact card */}
            <div className="overflow-hidden rounded-lg border bg-card">
              <button
                type="button"
                onClick={() => setStoreOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Store className="h-4 w-4" /> See shop location
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] text-[color:var(--ss-green)]">
                  {storeOpen ? "Hide" : "Show"}{" "}
                  {storeOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
              </button>
              {storeOpen && (
                <div className="border-t px-4 py-3 text-sm text-foreground">
                  {listing.listing_lat != null && listing.listing_lng != null ? (
                    <MapView lat={listing.listing_lat} lng={listing.listing_lng} address={listing.listing_address || seller?.shop_address || seller?.location || listing.location} label={listing.title} height={240} />
                  ) : (seller as any)?.shop_lat != null && (seller as any)?.shop_lng != null ? (
                    <MapView lat={(seller as any).shop_lat} lng={(seller as any).shop_lng} address={(seller as any).shop_address || seller?.location || listing.location} label={seller?.shop_name || seller?.full_name || listing.title} height={240} />
                  ) : (
                    seller?.location || listing.location || "No store address provided"
                  )}
                </div>
              )}
              <div className="border-t px-4 py-3 text-sm leading-relaxed text-foreground">
                <p className={descExpanded ? "whitespace-pre-wrap" : "line-clamp-6 whitespace-pre-wrap"}>
                  {listing.description}
                </p>
                {(listing.description?.length ?? 0) > 240 && (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-[13px] text-[color:var(--ss-green)] hover:underline"
                  >
                    {descExpanded ? "Show less" : "Show more"}
                    {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
              {phone && (
                <div className="px-4 pb-4">
                  <a href={telLink(phone)}>
                    <Button className="w-full gap-1.5 bg-[color:var(--ss-green)] hover:opacity-90">
                      <PhoneCall className="h-4 w-4" /> Show contact
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT column */}
          <aside className="flex flex-col gap-2.5 lg:sticky lg:top-20">
            {/* Price card */}
            <div className="rounded-lg border bg-card px-3.5 py-3.5">
              <p className="mb-2.5 text-[22px] font-medium leading-none text-foreground">
                {formatPrice(listing.price, listing.currency)}
              </p>
              {isOwner ? (
                <Link to="/edit/$id" params={{ id: listing.id }}>
                  <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[color:var(--ss-green)] py-2 text-[13px] font-medium text-[color:var(--ss-green)] hover:bg-[color:var(--ss-green)]/5">
                    <Pencil className="h-3.5 w-3.5" /> Edit your ad
                  </button>
                </Link>
              ) : (
                <button
                onClick={requestCallback}
                disabled={callbackSending}
                className="w-full rounded-lg border-[1.5px] border-[color:var(--ss-green)] py-2 text-[13px] font-medium text-[color:var(--ss-green)] hover:bg-[color:var(--ss-green)]/5 disabled:opacity-60"
              >
                {callbackSending ? "Sending…" : "Request call back"}
              </button>
              )}
              {!isOwner && (seller as any)?.shop_type === "services" && (
                <button
                  onClick={bookService}
                  disabled={booking}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--ss-blue)] py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <CalendarCheck className="h-4 w-4" /> {booking ? "Sending booking…" : "Book this service"}
                </button>
              )}
            </div>

            {/* Seller card */}
            <div className="rounded-lg border bg-card px-3.5 py-3.5">
              <div className="mb-2.5 flex items-center gap-2.5">
                <Link to="/shop/$id" params={{ id: listing.seller_id }} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#c8e6c9] text-[#2e7d32]">
                  <div className="grid h-full w-full place-items-center text-[13px] font-medium">
                    {(seller?.full_name || "S").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-[color:var(--ss-green)]" />
                </Link>
                <div className="min-w-0">
                  <Link to="/shop/$id" params={{ id: listing.seller_id }} className="block truncate text-[13px] font-medium hover:underline">
                    {seller?.full_name || "South Sudan Seller"}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[11px] text-[#555]">
                      <User className="h-2.5 w-2.5" /> {memberLabel(seller?.created_at)}
                    </span>
                    {seller?.id && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#e6f1fb] px-1.5 py-0.5 text-[11px] text-[#0c447c]">
                        <ShieldCheck className="h-2.5 w-2.5" /> Verified ID
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageCircle className="h-3 w-3" /> Typically replies within minutes
                  </p>
                </div>
              </div>

              <Link to="/shop/$id" params={{ id: listing.seller_id }}>
                <button className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[color:var(--ss-green)] py-2 text-[13px] font-medium text-[color:var(--ss-green)] hover:bg-[color:var(--ss-green)]/5">
                  <Store className="h-4 w-4" /> Visit shop · see all ads
                </button>
              </Link>

              {phone ? (
                <a href={telLink(phone)}>
                  <button className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--ss-green)] py-2 text-[13px] font-medium text-white hover:opacity-90">
                    <PhoneCall className="h-4 w-4" /> Show contact
                  </button>
                </a>
              ) : (
                <button disabled className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--ss-green)] py-2 text-[13px] font-medium text-white opacity-60">
                  <PhoneCall className="h-4 w-4" /> Show contact
                </button>
              )}
              <button
                onClick={() => setMsgOpen((v) => !v)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[color:var(--ss-green)] py-2 text-[13px] font-medium text-[color:var(--ss-green)] hover:bg-[color:var(--ss-green)]/5"
              >
                <MessageCircle className="h-4 w-4" /> Message seller
              </button>

              {msgOpen && (
                <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
                  <textarea
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder={`Hi! Is "${listing.title}" still available?`}
                    rows={3}
                    className="w-full resize-none rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ss-green)]"
                  />
                  <Button onClick={startConversation} disabled={sending} className="w-full bg-[color:var(--ss-blue)] text-white hover:opacity-90">
                    {sending ? "Sending…" : "Send & open chat"}
                  </Button>
                </div>
              )}
              {whatsapp && (
                <a href={waLink(whatsapp, `Hi, I'm interested in your "${listing.title}" on souqss.`)} target="_blank" rel="noreferrer">
                  <button className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#25D366] py-2 text-[13px] font-medium text-[#25D366] hover:bg-[#25D366]/5">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                </a>
              )}

              {/* Actions */}
              <div className="mt-2.5 flex gap-2">
                {isOwner ? (
                  <>
                    <Link to="/edit/$id" params={{ id: listing.id }} className="flex-1">
                      <button className="inline-flex w-full items-center justify-center gap-1 rounded-lg border-[1.5px] border-border bg-transparent py-2 text-xs text-[color:var(--ss-blue)] hover:bg-muted">
                        <Pencil className="h-3 w-3" /> Edit ad
                      </button>
                    </Link>
                    <button onClick={deleteListing} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border-[1.5px] border-border bg-transparent py-2 text-xs text-[color:var(--ss-red)] hover:bg-[color:var(--ss-red)]/5">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </>
                ) : (
                  <button className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border-[1.5px] border-border bg-transparent py-2 text-xs text-[color:var(--ss-red)] hover:bg-[color:var(--ss-red)]/5">
                    <Flag className="h-3 w-3" /> Report Abuse
                  </button>
                )}
              </div>
            </div>

            {/* Safety tips card */}
            <div className="rounded-lg border bg-card px-3.5 py-3.5">
              <p className="mb-2 text-sm font-medium">Safety tips</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>Avoid paying in advance, even for delivery</li>
                <li>Meet with the seller at a safe public place</li>
                <li>Inspect the item and ensure it's exactly what you want</li>
                <li>Make sure the packed item is the one you've inspected</li>
                <li>Only pay if you're satisfied</li>
              </ul>
              <Link to="/sell">
                <button className="mt-2.5 w-full rounded-lg border-[1.5px] border-border bg-transparent py-2 text-[13px] text-foreground hover:bg-muted">
                  Post ad like this
                </button>
              </Link>
            </div>
          </aside>
        </div>

        {/* Similar listings — same category */}
        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">
              More in <span className="text-[color:var(--ss-green)]">{listing.category}</span>
            </h2>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Browse all →</Link>
          </div>
          <SimilarListings category={listing.category} excludeId={listing.id} />
        </section>
      </main>
    </div>
  );
}

function Attr({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b py-2">
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      <p className="mt-0.5 text-[11px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function memberLabel(createdAt?: string | null) {
  if (!createdAt) return "New on souqss";
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 30) return `${Math.max(days, 1)} day${days === 1 ? "" : "s"} on souqss`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo${months === 1 ? "" : "s"} on souqss`;
  const years = Math.floor(days / 365);
  return `${years}+ year${years === 1 ? "" : "s"} on souqss`;
}

function SimilarListings({ category, excludeId }: { category: string; excludeId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["similar", category, excludeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,price,currency,location,images,created_at,category,seller_id")
        .eq("status", "active")
        .eq("category", category)
        .neq("id", excludeId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        No other listings in {category} yet.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((l) => (
        <ListingCard key={l.id} listing={l as any} />
      ))}
    </div>
  );
}

function MiniBar({ onShare }: { onShare?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>
        <Link to="/" className="text-base font-extrabold tracking-tight">
          souq<span className="text-[color:var(--ss-green)]">ss</span>
        </Link>
        {onShare ? (
          <button onClick={onShare} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        ) : <span className="w-16" />}
      </div>
    </header>
  );
}