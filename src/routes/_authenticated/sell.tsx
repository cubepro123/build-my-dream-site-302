import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CATEGORIES, SS_LOCATIONS } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { syncListing } from "@/lib/algolia.functions";
import { MapPicker } from "@/components/MapPicker";

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [{ title: "Post a listing — souqss" }] }),
  component: SellPage,
});

function SellPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const algSync = useServerFn(syncListing);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("Juba");
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; address: string; placeId?: string } | null>(null);
  const [currency, setCurrency] = useState<string>("SSP");
  const [condition, setCondition] = useState<string>("used");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 5 - files.length);
    setFiles((p) => [...p, ...picked]);
    setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
  }

  function removeImg(idx: number) {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function uploadImages(): Promise<string[]> {
    if (!user) return [];
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      // Use signed URL (private bucket with public read RLS, but we sign to be safe)
      const { data: signed } = await supabase.storage
        .from("listing-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5 years
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return urls;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!category) return toast.error("Please pick a category");
    setSubmitting(true);
    try {
      const f = new FormData(e.currentTarget);
      const images = await uploadImages();
      const { data, error } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          title: String(f.get("title")).trim(),
          description: String(f.get("description")).trim(),
          price: Number(f.get("price") || 0),
          currency,
          category,
          condition,
          location,
          listing_lat: mapLocation?.lat ?? null,
          listing_lng: mapLocation?.lng ?? null,
          listing_address: mapLocation?.address || null,
          listing_place_id: mapLocation?.placeId || null,
          phone: String(f.get("phone") || "") || null,
          whatsapp: String(f.get("whatsapp") || "") || null,
          images,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Listing posted!");
      algSync({ data: { id: data.id } }).catch((err) => console.warn("algolia sync failed", err));
      navigate({ to: "/listings/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not post listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">Post a listing</h1>
        <p className="mt-1 text-sm text-muted-foreground">It's free. Reach buyers all over South Sudan.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          {/* Images */}
          <div className="space-y-2">
            <Label>Photos (up to 5)</Label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {previews.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImg(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:border-[color:var(--ss-green)] hover:text-[color:var(--ss-green)]">
                  <ImagePlus className="h-6 w-6" />
                  <input type="file" accept="image/*,.heic,.heif,.HEIC,.HEIF,.avif" multiple className="hidden" onChange={onPick} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={120} placeholder="e.g. Toyota Hilux 2015, very clean" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Brand new</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="price">Price (0 = contact for price)</Label>
              <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">SSP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SS_LOCATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Exact map location</Label>
            <MapPicker value={mapLocation} onChange={setMapLocation} height={240} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required minLength={10} rows={5} placeholder="Describe what you're selling, condition, why you're selling, etc." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (for calls)</Label>
              <Input id="phone" name="phone" placeholder="+211…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp number</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="+211…" />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
            {submitting ? "Posting…" : "Post listing"}
          </Button>
        </form>
      </main>
    </div>
  );
}