import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initBoostOrder } from "@/lib/boost.functions";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useQueryClient } from "@tanstack/react-query";

declare global {
  interface Window { PaystackPop?: any }
}

function loadPaystack(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v2/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.head.appendChild(s);
  });
}

export function BoostModal({
  open, onOpenChange, listingId, listingTitle,
}: { open: boolean; onOpenChange: (o: boolean) => void; listingId: string; listingTitle: string }) {
  const { data: flags } = useFeatureFlags();
  const qc = useQueryClient();
  const [views, setViews] = useState(500);
  const [paying, setPaying] = useState(false);
  const rate = flags?.boost_price_per_view_ngn ?? 2;
  const days = flags?.boost_max_duration_days ?? 7;
  const total = Math.max(0, Math.ceil(views * rate));

  useEffect(() => {
    if (open) loadPaystack().catch(() => toast.error("Could not load payment widget"));
  }, [open]);

  async function pay() {
    if (views < 50) return toast.error("Minimum 50 views");
    setPaying(true);
    try {
      const order = await initBoostOrder({ data: { listing_id: listingId, views } });
      const pk = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;
      if (!pk) throw new Error("Paystack not configured");
      await loadPaystack();
      const handler = window.PaystackPop.setup({
        key: pk,
        email: order.email,
        amount: order.amount_kobo,
        currency: "NGN",
        ref: order.reference,
        metadata: { listing_id: listingId, listing_title: listingTitle, views },
        callback: () => {
          // Payment success on client. Webhook will activate boost.
          toast.success("Payment received — boost activating shortly");
          setTimeout(() => qc.invalidateQueries(), 2000);
          onOpenChange(false);
        },
        onClose: () => {
          setPaying(false);
        },
      });
      handler.openIframe();
    } catch (err: any) {
      toast.error(err.message ?? "Could not start payment");
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--ss-gold)]" />
            Boost this ad
          </DialogTitle>
          <DialogDescription>
            Pay per view. We show your ad to your chosen number of buyers across souqss. Ends after the views are delivered or {days} days — whichever comes first.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>How many people should see your ad?</Label>
            <Input
              type="number"
              min={50}
              step={50}
              value={views}
              onChange={(e) => setViews(Math.max(0, parseInt(e.target.value || "0", 10)))}
            />
            <p className="text-xs text-muted-foreground">Minimum 50 viewers. Rate: ₦{rate}/view.</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Viewers</span><span>{views.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Rate</span><span>₦{rate}/view</span></div>
            <div className="mt-1 flex justify-between border-t pt-1.5 text-base font-bold"><span>Total</span><span>₦{total.toLocaleString()}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>Cancel</Button>
          <Button onClick={pay} disabled={paying || views < 50} className="bg-[color:var(--ss-gold)] text-[color:var(--accent-foreground)] hover:opacity-90">
            {paying ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Processing…</> : <>Pay ₦{total.toLocaleString()}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
