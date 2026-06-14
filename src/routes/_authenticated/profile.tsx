import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, Briefcase, ShoppingBag, ExternalLink, Pencil, Upload, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MapPicker } from "@/components/MapPicker";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — souqss" }] }),
  component: ProfilePage,
});

type ShopType = "marketplace" | "services";
const SHOP_TYPE_LABEL: Record<ShopType, { name: string; desc: string; icon: typeof Store }> = {
  marketplace: { name: "Marketplace Seller", desc: "I sell physical products and goods.", icon: ShoppingBag },
  services: { name: "Service Provider", desc: "I offer services, skills or rentals.", icon: Briefcase },
};

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [logoUploading, setLogoUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    whatsapp: "",
    location: "",
    shop_name: "",
    shop_bio: "",
    shop_logo_url: "",
    shop_type: "" as "" | ShopType,
    shop_lat: null as number | null,
    shop_lng: null as number | null,
    shop_address: "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"type" | "details">("type");
  const [draft, setDraft] = useState<{ shop_type: ShopType | ""; shop_name: string; shop_logo_url: string; shop_bio: string }>({
    shop_type: "",
    shop_name: "",
    shop_logo_url: "",
    shop_bio: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        whatsapp: profile.whatsapp ?? "",
        location: profile.location ?? "",
        shop_name: (profile as any).shop_name ?? "",
        shop_bio: (profile as any).shop_bio ?? "",
        shop_logo_url: (profile as any).shop_logo_url ?? "",
        shop_type: ((profile as any).shop_type as ShopType) ?? "",
        shop_lat: (profile as any).shop_lat ?? null,
        shop_lng: (profile as any).shop_lng ?? null,
        shop_address: (profile as any).shop_address ?? "",
      });
    }
  }, [profile]);

  const hasShop = !!(profile as any)?.shop_name;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: any = {
      full_name: form.full_name,
      phone: form.phone,
      whatsapp: form.whatsapp,
      location: form.location,
      shop_name: form.shop_name || null,
      shop_bio: form.shop_bio || null,
      shop_logo_url: form.shop_logo_url || null,
      shop_type: form.shop_type || null,
      shop_lat: form.shop_lat,
      shop_lng: form.shop_lng,
      shop_address: form.shop_address || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function createShop() {
    if (!draft.shop_type || !draft.shop_name.trim()) {
      toast.error("Pick a shop type and add a name");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      shop_type: draft.shop_type,
      shop_name: draft.shop_name.trim(),
      shop_logo_url: draft.shop_logo_url || null,
      shop_bio: draft.shop_bio || null,
    }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Your shop is live!");
    setShopOpen(false);
    setCreateStep("type");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function uploadLogo(file: File, target: "form" | "draft") {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5MB)"); return; }
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("shop-logos").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("shop-logos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      const url = signed?.signedUrl;
      if (!url) throw new Error("Could not get image URL");
      if (target === "draft") setDraft((d) => ({ ...d, shop_logo_url: url }));
      else setForm((f) => ({ ...f, shop_logo_url: url }));
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-xl px-4 py-8">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Buyers will see your name and contacts on your listings.</p>
        <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+211…" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+211…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Juba" />
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>

        {/* Shop section */}
        <section className="mt-6">
          {!hasShop ? (
            <button
              type="button"
              onClick={() => { setDraft({ shop_type: "", shop_name: form.full_name || "", shop_logo_url: form.shop_logo_url, shop_bio: "" }); setCreateStep("type"); setShopOpen(true); }}
              className="group flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[color:var(--ss-green)]/50 bg-[color:var(--ss-green)]/5 p-5 text-left transition hover:bg-[color:var(--ss-green)]/10"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:var(--ss-green)] text-white shadow-md">
                <Store className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">Create your shop</div>
                <p className="text-xs text-muted-foreground">Brand your page so buyers can browse all your ads in one place.</p>
              </div>
              <span className="text-sm font-medium text-[color:var(--ss-green)]">Start →</span>
            </button>
          ) : (
            <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#c8e6c9] text-[#2e7d32]">
                  {form.shop_logo_url ? (
                    <img src={form.shop_logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-lg font-semibold">
                      {form.shop_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{form.shop_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {form.shop_type ? SHOP_TYPE_LABEL[form.shop_type as ShopType].name : "Shop"}
                  </div>
                </div>
                <a href={`/shop/${user?.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--ss-green)] hover:underline">
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Shop name</Label>
                  <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Shop logo</Label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground hover:bg-muted">
                    {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUploading ? "Uploading…" : form.shop_logo_url ? "Replace logo image" : "Upload logo image"}
                    <input type="file" accept="image/*,.heic,.heif,.HEIC,.HEIF,.avif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f, "form"); e.target.value = ""; }} />
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label>About your shop</Label>
                  <textarea
                    value={form.shop_bio}
                    onChange={(e) => setForm({ ...form, shop_bio: e.target.value })}
                    rows={3}
                    maxLength={400}
                    placeholder="Tell customers what you offer…"
                    className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ss-green)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Shop location on map</Label>
                  <p className="text-[11px] text-muted-foreground">Search your area or drop the pin so buyers can find you.</p>
                  <MapPicker
                    value={form.shop_lat != null && form.shop_lng != null ? { lat: form.shop_lat, lng: form.shop_lng, address: form.shop_address } : null}
                    onChange={(v) => setForm((f) => ({ ...f, shop_lat: v.lat, shop_lng: v.lng, shop_address: v.address }))}
                  />
                </div>
                <Button type="button" onClick={save as any} disabled={saving} variant="outline" className="w-full">
                  <Pencil className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Update shop"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Dialog open={shopOpen} onOpenChange={(o) => { setShopOpen(o); if (!o) setCreateStep("type"); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createStep === "type" ? "What kind of shop?" : "Set up your shop"}</DialogTitle>
            <DialogDescription>
              {createStep === "type" ? "Pick the option that fits you best." : "You can edit these anytime."}
            </DialogDescription>
          </DialogHeader>

          {createStep === "type" ? (
            <div className="space-y-2">
              {(Object.keys(SHOP_TYPE_LABEL) as ShopType[]).map((t) => {
                const meta = SHOP_TYPE_LABEL[t];
                const Icon = meta.icon;
                const selected = draft.shop_type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft({ ...draft, shop_type: t })}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${selected ? "border-[color:var(--ss-green)] bg-[color:var(--ss-green)]/5" : "border-border hover:bg-muted"}`}
                  >
                    <div className={`grid h-11 w-11 place-items-center rounded-full ${selected ? "bg-[color:var(--ss-green)] text-white" : "bg-muted text-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{meta.name}</div>
                      <div className="text-xs text-muted-foreground">{meta.desc}</div>
                    </div>
                  </button>
                );
              })}
              <DialogFooter className="mt-2">
                <Button type="button" disabled={!draft.shop_type} onClick={() => setCreateStep("details")} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
                  Continue
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#c8e6c9] text-[#2e7d32]">
                  {draft.shop_logo_url ? (
                    <img src={draft.shop_logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-base font-semibold">
                      {(draft.shop_name || "S").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label className="text-xs">Logo</Label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 p-2 text-xs text-muted-foreground hover:bg-muted">
                    {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {logoUploading ? "Uploading…" : draft.shop_logo_url ? "Replace" : "Upload image"}
                    <input type="file" accept="image/*,.heic,.heif,.HEIC,.HEIF,.avif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f, "draft"); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Shop name</Label>
                <Input value={draft.shop_name} onChange={(e) => setDraft({ ...draft, shop_name: e.target.value })} placeholder="e.g. Juba Electronics" />
              </div>
              <div className="space-y-1.5">
                <Label>Short description (optional)</Label>
                <textarea
                  value={draft.shop_bio}
                  onChange={(e) => setDraft({ ...draft, shop_bio: e.target.value })}
                  rows={3}
                  maxLength={400}
                  placeholder="What do you sell or offer?"
                  className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ss-green)]"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateStep("type")}>Back</Button>
                <Button type="button" disabled={saving || !draft.shop_name.trim()} onClick={createShop} className="flex-1 bg-[color:var(--ss-green)] hover:opacity-90">
                  {saving ? "Creating…" : "Create shop"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}