import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { ChatPanel, initialsOf, colorFor } from "@/components/ChatPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — souqss" }] }),
  component: MessagesList,
});

function MessagesList() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const childMatched = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/_authenticated/messages/$id"),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "unread" | "spam">("all");
  const [q, setQ] = useState("");

  const { data: convs = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, listing_id, buyer_id, seller_id, last_message_at, listings(title, images, price, currency)")
        .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const otherIds = Array.from(new Set(rows.map((c: any) => (c.seller_id === user!.id ? c.buyer_id : c.seller_id))));
      let nameById: Record<string, string> = {};
      if (otherIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
        nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || "user"]));
      }
      // Fetch latest message preview per conversation
      const convIds = rows.map((c: any) => c.id);
      let lastByConv: Record<string, { body: string; sender_id: string }> = {};
      if (convIds.length) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, body, sender_id, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        for (const m of msgs ?? []) {
          if (!lastByConv[(m as any).conversation_id]) {
            lastByConv[(m as any).conversation_id] = { body: (m as any).body, sender_id: (m as any).sender_id };
          }
        }
      }
      return rows.map((c: any) => ({
        ...c,
        otherName: nameById[c.seller_id === user!.id ? c.buyer_id : c.seller_id] || "user",
        lastMessage: lastByConv[c.id]?.body || null,
        lastSenderId: lastByConv[c.id]?.sender_id || null,
      }));
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return convs;
    return convs.filter((c: any) =>
      (c.otherName || "").toLowerCase().includes(s) ||
      (c.listings?.title || "").toLowerCase().includes(s) ||
      (c.lastMessage || "").toLowerCase().includes(s),
    );
  }, [convs, q]);

  const activeId = selectedId ?? (!isMobile ? filtered[0]?.id ?? null : null);

  if (isMobile && childMatched) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* App header — desktop only; mobile gets a native-feeling full-screen list */}
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 md:px-4 md:py-6">
        <div className="flex h-[100dvh] overflow-hidden bg-card md:h-[calc(100vh-9rem)] md:rounded-xl md:border md:shadow-sm">
          {/* Sidebar / mobile list */}
          <aside className="flex w-full flex-col border-r md:w-[320px] md:shrink-0">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-3.5 pb-2 pt-[max(0.875rem,env(safe-area-inset-top))] md:static md:pt-4">
              <h1 className="text-[17px] font-medium md:text-base">My messages</h1>
              <Pencil className="h-5 w-5 text-muted-foreground md:hidden" />
            </div>
            <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 md:mx-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground md:py-1.5"
              />
            </div>
            <div className="flex gap-4 border-b px-3.5">
              {(["all", "unread", "spam"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-1.5 pt-1 text-[13px] capitalize ${tab === t ? "border-b-2 border-[color:var(--ss-green)] font-medium text-[color:var(--ss-green)]" : "border-b-2 border-transparent text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {convs.length === 0 ? "No conversations yet. Open a listing and message the seller." : "No matches."}
                </p>
              )}
              {filtered.map((c: any) => {
                const isActive = c.id === activeId;
                const preview = c.lastMessage
                  ? (c.lastSenderId === user?.id ? "You: " : "") + c.lastMessage
                  : "New conversation";
                const date = new Date(c.last_message_at).toLocaleDateString([], { day: "numeric", month: "short" });
                return (
                  <Link
                    key={c.id}
                    to="/messages/$id"
                    params={{ id: c.id }}
                    onClick={(e) => {
                      // On desktop (>=md), keep split-view inline instead of navigating
                      if (typeof window !== "undefined" && window.innerWidth >= 768) {
                        e.preventDefault();
                        setSelectedId(c.id);
                      }
                    }}
                    className={`flex w-full items-start gap-2.5 border-b px-3.5 py-3 text-left transition active:bg-muted hover:bg-muted/50 md:items-center md:gap-2.5 md:px-3 md:py-2.5 ${isActive ? "bg-muted/60" : ""}`}
                  >
                    {/* Square rounded avatar on mobile, circle on desktop */}
                    <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-semibold text-white md:h-11 md:w-11 md:rounded-full md:text-sm" style={{ background: colorFor(c.otherName) }}>
                      {initialsOf(c.otherName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-medium">{c.otherName}</span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">{date}</span>
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">{c.listings?.title || "Listing"}</div>
                      <div className="truncate text-[12px] text-muted-foreground">{preview}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>

          {/* Chat panel — desktop only inline */}
          <div className="hidden flex-1 md:flex">
            {activeId ? (
              <ChatPanel conversationId={activeId} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}