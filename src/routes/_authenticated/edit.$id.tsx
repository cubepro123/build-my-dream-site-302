import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X, ArrowLeft, Trash2 } from "lucide-react";
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
import { syncListing, deleteListingFromIndex } from "@/lib/algolia.functions";
import { MapPicker } from "@/components/MapPicker";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  head: () => ({ meta: [{ title: "Edit listing — souqss" }] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const algSync = useServerFn(syncListing);
  const algDelete = useServerFn(deleteListingFromIndex);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["edit-listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("used");
  const [location, setLocation] = useState("Juba");
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; address: string; placeId?: string } | null>(null);
  const [currency, setCurrency] = useState("SSP");
  const [status, setStatus] = useState("active");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initialized = useRef(false);
  useEffect(() => {
    if (!listing || initialized.current) return;
    initialized.current = true;
    setTitle(listing.title ?? "");
    setDescription(listing.description ?? "");
    setPrice(Number(listing.price ?? 0));
    setPhone(listing.phone ?? "");
    setWhatsapp(listing.whatsapp ?? "");
    setCategory(listing.category ?? "");
    setCondition(listing.condition ?? "used");
    setLocation(listing.location ?? "Juba");
    setMapLocation(listing.listing_lat != null && listing.listing_lng != null ? {
      lat: listing.listing_lat,
      lng: listing.listing_lng,
      address: listing.listing_address ?? "",
      placeId: listing.listing_place_id ?? undefined,
    } : null);
    setCurrency(listing.currency ?? "SSP");
    setStatus(listing.status ?? "active");
    setExistingImages(listing.images ?? []);
  }, [listing]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="font-semibold">Listing not found</p>
          <Link to="/my-listings"><Button className="mt-3">Back to my listings</Button></Link>
        </main>
      </div>
    );
  }

  if (user && listing.seller_id !== user.id) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="font-semibold">You can only edit your own listings.</p>
          <Link to="/my-listings"><Button className="mt-3">Back to my listings</Button></Link>
        </main>
      </div>
    );
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const slots = 5 - existingImages.length - newFiles.length;
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(slots, 0));
    setNewFiles((p) => [...p, ...picked]);
    setNewPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeExisting(i: number) {
    setExistingImages((p) => p.filter((_, idx) => idx !== i));
  }
  function removeNew(i: number) {
    setNewFiles((p) => p.filter((_, idx) => idx !== i));
    setNewPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function uploadNew(): Promise<string[]> {
    if (!user || newFiles.length === 0) return [];
    const urls: string[] = [];
    for (const file of newFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("listing-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return urls;
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!category) return toast.error("Please pick a category");
    setSubmitting(true);
    try {
      const uploaded = await uploadNew();
      const images = [...existingImages, ...uploaded];
      const { error } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          currency,
          category,
          condition,
          location,
          listing_lat: mapLocation?.lat ?? null,
          listing_lng: mapLocation?.lng ?? null,
          listing_address: mapLocation?.address || null,
          listing_place_id: mapLocation?.placeId || null,
          status,
          phone: phone || null,
          whatsapp: whatsapp || null,
          images,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Listing updated");
      algSync({ data: { id } }).catch((err) => console.warn("algolia sync failed", err));
      navigate({ to: "/listings/$id", params: { id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not update");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    algDelete({ data: { id } }).catch((err) => console.warn("algolia delete failed", err));
    toast.success("Listing deleted");
    navigate({ to: "/my-listings" });
  }

  const totalImgs = existingImages.length + newFiles.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-6 pb-28 sm:py-8">
        <Link to="/my-listings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> My listings
        </Link>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Edit listing</h1>

        <form onSubmit={onSave} className="mt-5 space-y-5 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active — visible to buyers</SelectItem>
                <SelectItem value="sold">Sold / Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Photos ({totalImgs}/5)</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
              {existingImages.map((src, i) => (
                <div key={`e-${i}`} className="relative aspect-square overflow-hidden rounded-lg border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeExisting(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPreviews.map((p, i) => (
                <div key={`n-${i}`} className="relative aspect-square overflow-hidden rounded-lg border">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeNew(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {totalImgs < 5 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:border-[color:var(--ss-green)] hover:text-[color:var(--ss-green)]">
                  <ImagePlus className="h-6 w-6" />
                  <input type="file" accept="image/*,.heic,.heif,.HEIC,.HEIF,.avif" multiple className="hidden" onChange={onPick} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
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
              <Input id="price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
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
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} rows={5} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+211…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+211…" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={submitting} className="w-full bg-[color:var(--ss-green)] hover:opacity-90 sm:flex-1">
              {submitting ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={onDelete} className="w-full sm:w-auto">
              <Trash2 className="mr-1 h-4 w-4" /> {deleting ? "Deleting…" : "Delete listing"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}