import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, MoreVertical, Smile, Paperclip, Send, ChevronLeft, MessageCircle, Flag, Ban, X, Check, CheckCheck, Mic, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { normalizeWa } from "@/lib/format";

function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
function colorFor(seed?: string | null) {
  const colors = ["#5a3e2b", "#2356a0", "#888", "#c0392b", "#555", "#1a8c2e", "#7b3fa0", "#0a8a8a"];
  if (!seed) return colors[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

const QUICK_REPLIES = ["Last price", "Is this available", "Ask for location", "Make an offer", "Please call me"];

export function ChatPanel({ conversationId, backTo }: { conversationId: string; backTo?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [text, setText] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Spam");
  const [reportDetails, setReportDetails] = useState("");
  const [uploading, setUploading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentTypingRef = useRef<number>(0);
  const otherTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Voice-note recording
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCancelledRef = useRef(false);

  const { data: conv } = useQuery({
    queryKey: ["conv", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, listings(id, title, images, price, currency)")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const otherId = data.seller_id === user?.id ? data.buyer_id : data.seller_id;
      const { data: prof } = await supabase.from("profiles").select("full_name, phone, whatsapp").eq("id", otherId).maybeSingle();
      return {
        ...data,
        otherId,
        otherName: prof?.full_name || "user",
        otherPhone: prof?.phone || null,
        otherWhatsapp: prof?.whatsapp || prof?.phone || null,
      };
    },
    enabled: !!user,
  });

  const otherId = conv?.otherId ?? null;

  // Block status (either direction)
  const { data: blockState } = useQuery({
    queryKey: ["block", user?.id, otherId],
    queryFn: async () => {
      if (!user || !otherId) return { iBlocked: false, blockedMe: false };
      const { data } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${user.id})`);
      const rows = data ?? [];
      return {
        iBlocked: rows.some((r: any) => r.blocker_id === user.id),
        blockedMe: rows.some((r: any) => r.blocker_id === otherId),
      };
    },
    enabled: !!user && !!otherId,
  });
  const isBlocked = !!(blockState?.iBlocked || blockState?.blockedMe);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  // Typing indicator via broadcast
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload?.payload?.userId && payload.payload.userId !== user.id) {
        setOtherTyping(true);
        if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
        otherTypingTimerRef.current = setTimeout(() => setOtherTyping(false), 2500);
      }
    }).subscribe();
    typingChRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChRef.current = null;
      if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current);
    };
  }, [conversationId, user]);

  function notifyTyping() {
    const now = Date.now();
    if (!typingChRef.current || !user) return;
    if (now - lastSentTypingRef.current < 1500) return;
    lastSentTypingRef.current = now;
    typingChRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { lastSentTypingRef.current = 0; }, 1500);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, otherTyping]);

  // Jump to the latest message instantly when a chat is first opened
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // run twice — once for layout, once after images/audio populate
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length > 0]);

  // Mark unread messages from the other side as read
  useEffect(() => {
    if (!user || !messages.length) return;
    const unreadIds = (messages as any[])
      .filter((m) => m.sender_id !== user.id && !m.read_at)
      .map((m) => m.id);
    if (!unreadIds.length) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      });
  }, [messages, user, conversationId, qc]);

  async function send(body?: string, attachments?: string[]) {
    const b = (body ?? text).trim();
    const atts = attachments ?? [];
    if ((!b && atts.length === 0) || !user) return;
    if (!body) setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: b || (atts.length ? "📎 Attachment" : ""),
      attachments: atts,
    });
    if (error) {
      toast.error(isBlocked ? "You can't message this user" : error.message);
      if (!body) setText(b);
    } else {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${user.id}/${conversationId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (signed?.signedUrl) urls.push(signed.signedUrl);
      }
      if (urls.length) await send("", urls);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadBlob(blob: Blob, ext: string): Promise<string | null> {
    if (!user) return null;
    const path = `${user.id}/${conversationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    return signed?.signedUrl ?? null;
  }

  async function startRecording() {
    if (recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice notes are not supported on this device");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recChunksRef.current = [];
      recCancelledRef.current = false;
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) recChunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecording(false);
        setRecSeconds(0);
        if (recCancelledRef.current) return;
        const blob = new Blob(recChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        if (blob.size > 10 * 1024 * 1024) { toast.error("Voice note too long"); return; }
        const ext = (rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        setUploading(true);
        try {
          const url = await uploadBlob(blob, ext);
          if (url) await send("", [url]);
        } catch (err: any) {
          toast.error(err.message ?? "Could not send voice note");
        } finally { setUploading(false); }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => {
          if (s >= 119) { stopRecording(false); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message?.includes("Permission") ? "Microphone permission denied" : "Could not start recording");
    }
  }

  function stopRecording(cancel: boolean) {
    const rec = recorderRef.current;
    if (!rec) return;
    recCancelledRef.current = cancel;
    if (rec.state !== "inactive") rec.stop();
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else if (backTo) {
      router.navigate({ to: backTo });
    }
  }

  async function toggleBlock() {
    if (!user || !otherId) return;
    if (blockState?.iBlocked) {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", otherId);
      if (error) return toast.error(error.message);
      toast.success("Unblocked");
    } else {
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: user.id, blocked_id: otherId });
      if (error) return toast.error(error.message);
      toast.success("User blocked");
    }
    qc.invalidateQueries({ queryKey: ["block", user.id, otherId] });
    setMenuOpen(false);
  }

  async function submitReport() {
    if (!user || !otherId) return;
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: otherId,
      conversation_id: conversationId,
      reason: reportReason,
      details: reportDetails || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Report submitted. Thank you.");
    setReportOpen(false);
    setReportDetails("");
  }

  const otherName = conv?.otherName || "user";
  const listing = conv?.listings;
  const waNumber = normalizeWa(conv?.otherWhatsapp);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      {/* Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b bg-card px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          {backTo && (
            <button type="button" onClick={handleBack} className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--ss-green)] hover:bg-muted" aria-label="Back">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {otherId ? (
            <Link to="/shop/$id" params={{ id: otherId }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: colorFor(otherName) }} aria-label="View shop">
              {initialsOf(otherName)}
            </Link>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: colorFor(otherName) }}>
              {initialsOf(otherName)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          {otherId ? (
            <Link to="/shop/$id" params={{ id: otherId }} className="block truncate text-[15px] font-medium leading-tight hover:underline">{otherName}</Link>
          ) : (
            <div className="truncate text-[15px] font-medium leading-tight">{otherName}</div>
          )}
          {otherTyping && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--ss-green)]">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--ss-green)]" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--ss-green)]" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--ss-green)]" style={{ animationDelay: "300ms" }} />
              </span>
              typing…
            </div>
          )}
        </div>
        <div className="relative flex items-center">
          {(conv?.otherPhone || waNumber) && showContact && (
            <>
              {conv?.otherPhone && (
                <a href={`tel:${conv.otherPhone}`} className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--ss-green)] hover:bg-muted" aria-label="Call">
                  <Phone className="h-5 w-5" />
                </a>
              )}
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full text-[#25D366] hover:bg-muted" aria-label="WhatsApp">
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="More"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-lg border bg-card shadow-lg">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <Flag className="h-4 w-4" /> Report user
                </button>
                <button
                  type="button"
                  onClick={toggleBlock}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-muted"
                >
                  <Ban className="h-4 w-4" /> {blockState?.iBlocked ? "Unblock user" : "Block user"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Listing banner — full-width, no squeezing */}
      {listing && (
        <div className="flex items-center gap-2.5 border-b bg-card px-3.5 py-2.5">
          <Link to="/listings/$id" params={{ id: listing.id }} className="shrink-0">
            <div className="h-11 w-11 overflow-hidden rounded-lg border bg-muted">
              {listing.images?.[0] ? <img src={listing.images[0]} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          </Link>
          <Link to="/listings/$id" params={{ id: listing.id }} className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium leading-tight">{listing.title}</div>
            <div className="text-[13px] font-medium leading-tight text-[color:var(--ss-green)]">
              {listing.currency} {Number(listing.price).toLocaleString()}
            </div>
          </Link>
          {(conv?.otherPhone || waNumber) && !showContact && (
            <button
              onClick={() => setShowContact(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border-[1.5px] border-[color:var(--ss-green)] px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--ss-green)] active:scale-95"
            >
              <Phone className="h-3.5 w-3.5" /> Contact
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background px-3.5 py-3.5">
        {messages.length > 0 && (
          <div className="self-center text-[12px] text-muted-foreground">
            {new Date((messages[0] as any).created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
          </div>
        )}
        <div className="self-center rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[12px] text-amber-800">
          🔔 Avoid paying in advance! Even for delivery
        </div>
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">No messages yet — say hi 👋</p>
        )}
        {messages.map((m: any) => {
          const mine = m.sender_id === user?.id;
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const atts: string[] = Array.isArray(m.attachments) ? m.attachments : [];
          const isImage = (u: string) => /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)(\?|$)/i.test(u);
          const isAudio = (u: string) => /\.(webm|m4a|mp3|ogg|oga|wav|aac)(\?|$)/i.test(u);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] overflow-hidden break-words text-[14px] leading-snug sm:max-w-[70%] ${
                  mine
                    ? "rounded-[12px_12px_2px_12px] bg-[color:var(--ss-green)] text-white"
                    : "rounded-[12px_12px_12px_2px] bg-muted text-foreground"
                }`}
              >
                {atts.length > 0 && (
                  <div className={`grid w-[240px] gap-1 sm:w-[280px] ${atts.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {atts.map((u, i) =>
                      isImage(u) ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightbox(u)}
                          className="block overflow-hidden bg-black/5"
                        >
                          <img
                            src={u}
                            alt="Attachment"
                            loading="lazy"
                            className="block h-auto max-h-72 w-full object-cover"
                          />
                        </button>
                      ) : isAudio(u) ? (
                        <VoiceNote key={i} url={u} mine={mine} />
                      ) : (
                        <a key={i} href={u} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-3 py-2 text-xs underline ${mine ? "text-white" : "text-foreground"}`}>
                          <Paperclip className="h-4 w-4" /> Attachment
                        </a>
                      ),
                    )}
                  </div>
                )}
                {m.body && m.body !== "📎 Attachment" && (
                  <div className="whitespace-pre-wrap break-words px-3.5 py-2.5">{m.body}</div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{time}</span>
                {mine && (m.read_at ? <CheckCheck className="h-3.5 w-3.5 text-[color:var(--ss-green)]" /> : <Check className="h-3.5 w-3.5" />)}
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex items-start">
            <div className="flex items-center gap-1 rounded-[12px_12px_12px_2px] bg-muted px-3 py-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {isBlocked && (
        <div className="border-t bg-muted/50 px-4 py-3 text-center text-xs text-muted-foreground">
          {blockState?.iBlocked
            ? "You've blocked this user. Unblock from the menu to resume the chat."
            : "You can no longer message this user."}
        </div>
      )}

      {/* Quick replies — wrapping pills */}
      {!isBlocked && (
      <div className="flex flex-wrap gap-2 border-t bg-card px-3.5 py-2.5">
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="whitespace-nowrap rounded-full border-[1.5px] border-[color:var(--ss-green)] bg-transparent px-3 py-1 text-[12px] font-medium text-[color:var(--ss-green)] active:bg-[color:var(--ss-green)]/10"
          >
            {q}
          </button>
        ))}
      </div>
      )}

      {/* Composer */}
      {!isBlocked && (
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t bg-card px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif,.HEIC,.HEIF,.avif"
          onChange={onFiles}
          className="hidden"
        />
        {recording ? (
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-muted"
              aria-label="Cancel recording"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-red-50 px-3 py-2 dark:bg-red-950/30">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <div className="flex flex-1 items-end gap-[2px] h-5 overflow-hidden">
                {Array.from({ length: 24 }).map((_, k) => (
                  <span
                    key={k}
                    className="w-[3px] flex-1 rounded-full bg-red-400"
                    style={{
                      height: `${20 + Math.abs(Math.sin((recSeconds * 1.2) + k * 0.6)) * 70}%`,
                      transition: "height 200ms linear",
                    }}
                  />
                ))}
              </div>
              <span className="text-[12px] tabular-nums font-medium text-red-700 dark:text-red-300">
                {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--ss-green)] text-white active:scale-95"
              aria-label="Send voice note"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Smile className="h-[22px] w-[22px] shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="shrink-0 text-muted-foreground disabled:opacity-50"
              aria-label="Attach"
            >
              <Paperclip className="h-[22px] w-[22px]" />
            </button>
            <input
              value={text}
              onChange={(e) => { setText(e.target.value); notifyTyping(); }}
              placeholder={uploading ? "Uploading…" : "Type a message"}
              disabled={uploading}
              className="min-w-0 flex-1 bg-transparent py-1 text-[14px] outline-none placeholder:text-muted-foreground"
            />
            {text.trim() ? (
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--ss-green)] text-white active:scale-95 disabled:opacity-50"
                disabled={uploading}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploading}
                aria-label="Record voice note"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--ss-green)] hover:bg-muted disabled:opacity-50"
              >
                <Mic className="h-[22px] w-[22px]" />
              </button>
            )}
          </>
        )}
      </form>
      )}

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setReportOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Report {otherName}</h3>
              <button onClick={() => setReportOpen(false)} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option>Spam</option>
              <option>Scam or fraud</option>
              <option>Abusive language</option>
              <option>Inappropriate content</option>
              <option>Other</option>
            </select>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Details (optional)</label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              maxLength={500}
              className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Tell us what happened…"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReportOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button onClick={submitReport} className="rounded-md bg-[color:var(--ss-green)] px-3 py-2 text-sm font-medium text-white">Submit report</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        </div>
      )}
    </div>
  );
}

export { initialsOf, colorFor };

function VoiceNote({ url, mine }: { url: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  const fg = mine ? "bg-white" : "bg-[color:var(--ss-green)]";
  const fgSoft = mine ? "bg-white/30" : "bg-foreground/15";
  const btn = mine ? "bg-white text-[color:var(--ss-green)]" : "bg-[color:var(--ss-green)] text-white";
  const txt = mine ? "text-white/90" : "text-muted-foreground";

  return (
    <div className="flex w-[240px] items-center gap-2.5 px-3 py-2.5 sm:w-[260px]">
      <button
        type="button"
        onClick={toggle}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${btn} active:scale-95`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className={`flex h-5 items-end gap-[2px] overflow-hidden`}>
          {Array.from({ length: 22 }).map((_, k) => {
            const active = (k / 22) * 100 <= pct;
            return (
              <span
                key={k}
                className={`w-[3px] flex-1 rounded-full ${active ? fg : fgSoft}`}
                style={{
                  height: `${30 + Math.abs(Math.sin(k * 0.9 + 1.2)) * 70}%`,
                }}
              />
            );
          })}
        </div>
        <div className={`text-[11px] tabular-nums ${txt}`}>
          {fmt(playing || pos > 0 ? pos : dur)}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDur((e.currentTarget.duration) || 0)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
      />
    </div>
  );
}