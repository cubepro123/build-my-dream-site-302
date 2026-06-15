import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, MapPin, ShieldCheck, MessageCircle, PhoneCall, Sparkles, TrendingUp, Zap, Tag } from "lucide-react";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, SS_LOCATIONS } from "@/lib/format";
import { CATEGORY_META } from "@/lib/categories";
import { useAuth } from "@/lib/auth-context";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { InstallAppButton } from "@/components/InstallAppButton";

const ALG_APP = import.meta.env.VITE_LOVABLE_CONNECTOR_ALGOLIA_APPLICATION_ID;
const ALG_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_ALGOLIA_PUBLIC_API_KEY;
const algClient = ALG_APP && ALG_KEY ? algoliasearch(ALG_APP, ALG_KEY) : null;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "souqss — Buy & Sell Anything in South Sudan" },
      { name: "description", content: "South Sudan's everything marketplace. Browse cars, phones, fashion, property, services and more. Post free ads in seconds." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const useSearch = !!debouncedQ && !!algClient;

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", category, debouncedQ, location, useSearch, user?.id ?? "anon"],
    queryFn: async () => {
      if (useSearch) {
        const filters: string[] = ["status:active"];
        if (category) filters.push(`category:"${category.replace(/"/g, '\\"')}"`);
        if (location) filters.push(`location:"${location.replace(/"/g, '\\"')}"`);
        const res: any = await algClient!.search({
          requests: [{
            indexName: "listings",
            query: debouncedQ,
            filters: filters.join(" AND "),
            hitsPerPage: 60,
          }],
        });
        const hits = res?.results?.[0]?.hits ?? [];
        return hits.map((h: any) => ({
          id: h.objectID,
          title: h.title,
          price: h.price,
          currency: h.currency,
          location: h.location,
          images: h.images ?? [],
          created_at: h.created_at_ts ? new Date(h.created_at_ts * 1000).toISOString() : new Date().toISOString(),
          category: h.category,
          seller_id: h.seller_id,
        }));
      }
      const cols = "id,title,price,currency,location,images,created_at,category,seller_id";
      let query = supabase
        .from("listings")
        .select(cols)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (category) query = query.eq("category", category);
      if (location) query = query.eq("location", location);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <InstallAppButton />

      {/* Hero */}
      <section className="relative overflow-hidden border-b" style={{ background: "var(--gradient-hero)" }}>
        {/* Decorative animated blobs (CSS-only, GPU-friendly) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-[color:var(--ss-gold)] opacity-30 blur-3xl animate-blob" />
          <div className="absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[color:var(--ss-green)] opacity-25 blur-3xl animate-blob [animation-delay:3s]" />
          <div className="absolute top-1/3 left-1/2 h-64 w-64 rounded-full bg-white opacity-10 blur-2xl animate-blob [animation-delay:6s]" />
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              color: "white",
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            }}
          />
        </div>
        <div className="container relative mx-auto px-4 py-14 md:py-24 text-white">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-[color:var(--ss-gold)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--ss-gold)] animate-fade-in">
              <Sparkles className="mr-1 h-3 w-3" /> Made for South Sudan 🇸🇸
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight animate-fade-in">
              <span className="text-yellow-400">Find</span> anything. <br />
              <span className="bg-gradient-to-r from-[color:var(--ss-gold)] via-amber-200 to-[color:var(--ss-gold)] bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
                Sell everything.
              </span>
            </h1>
            <p className="mt-4 text-lg text-white/85 max-w-lg">
              From Juba to Wau — South Sudan's everything marketplace. Post a listing in seconds, chat with buyers, or share your number on WhatsApp. ✨
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                document.getElementById("listings-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-xl bg-white p-2 shadow-[var(--shadow-elevated)] ring-1 ring-white/40 transition focus-within:ring-4 focus-within:ring-[color:var(--ss-gold)]/40"
            >
              <Search className="ml-2 h-5 w-5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for a phone, car, house, anything…"
                className="flex-1 border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
              />
              <Button type="submit" className="bg-[color:var(--ss-green)] text-white hover:opacity-90">
                Search
              </Button>
              <Link to="/sell">
                <Button type="button" className="bg-[color:var(--ss-gold)] text-[color:var(--accent-foreground)] hover:opacity-90">
                  Post free ad
                </Button>
              </Link>
            </form>
            {/* Trending chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-white/70"><TrendingUp className="h-3.5 w-3.5" /> Trending:</span>
              {["iPhone", "Toyota", "Apartment in Juba", "Generator", "Sofa"].map((t) => (
                <button
                  key={t}
                  onClick={() => setQ(t)}
                  className="rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur transition hover:bg-white/20"
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Verified sellers</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> In-app chat</span>
              <span className="inline-flex items-center gap-1.5"><PhoneCall className="h-4 w-4" /> WhatsApp & calls</span>
            </div>
          </div>
        </div>
        {/* Wave divider */}
        <svg aria-hidden viewBox="0 0 1440 80" className="block w-full text-background" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,32L80,37.3C160,43,320,53,480,53.3C640,53,800,43,960,37.3C1120,32,1280,32,1360,32L1440,32L1440,80L0,80Z" />
        </svg>
      </section>

      {/* Stats / city strip */}
      <section className="border-b bg-card">
        <div className="container mx-auto grid grid-cols-2 gap-4 px-4 py-5 text-center md:grid-cols-4">
          {[
            { icon: Zap, label: "Post in 60s" },
            { icon: Tag, label: "Free listings" },
            { icon: MessageCircle, label: "Chat & WhatsApp" },
            { icon: MapPin, label: "Juba · Wau · Malakal" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 text-sm font-medium text-foreground/80">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--ss-green)]/10 text-[color:var(--ss-green)]">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Shop by category — icon grid */}
      <section className="container mx-auto px-4 pt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold">Shop by category</h2>
          {category && (
            <button onClick={() => setCategory(null)} className="text-xs text-muted-foreground underline">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {CATEGORIES.map((c) => {
            const { icon: Icon, color } = CATEGORY_META[c];
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(active ? null : c)}
                className={`group flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] ${
                  active ? "border-[color:var(--ss-green)] ring-2 ring-[color:var(--ss-green)]/30" : ""
                }`}
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-full transition group-hover:scale-110"
                  style={{ backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="line-clamp-2 text-xs font-medium leading-tight">{c}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter bar: location + active chip */}
      <section className="container mx-auto px-4 pt-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-[color:var(--ss-green)]" /> Location:
          </div>
          <div className="flex flex-1 flex-wrap gap-1.5">
            <button
              onClick={() => setLocation(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                location === null ? "bg-[color:var(--ss-blue)] text-white" : "bg-muted hover:bg-muted/70"
              }`}
            >
              All South Sudan
            </button>
            {SS_LOCATIONS.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  location === loc ? "bg-[color:var(--ss-blue)] text-white" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section id="listings-grid" className="container mx-auto px-4 py-8 scroll-mt-20">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">
            {category ? category : "Latest listings"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              <MapPin className="-mt-1 mr-0.5 inline h-3 w-3" /> South Sudan
            </span>
          </h2>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center">
            <p className="text-lg font-semibold">No listings yet{category ? ` in ${category}` : ""}.</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to post something!</p>
            <Link to="/sell">
              <Button className="mt-4 bg-[color:var(--ss-green)] hover:opacity-90">Post a listing</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {listings.map((l: any) => (
              <ListingCard key={l.id} listing={l as any} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t bg-card mt-12">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} souqss — Marketplace of South Sudan 🇸🇸</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/contact" className="hover:text-foreground hover:underline">Contact</Link>
            <Link to="/disclaimer" className="hover:text-foreground hover:underline">Disclaimer</Link>
            <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground hover:underline">Terms &amp; Conditions</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
