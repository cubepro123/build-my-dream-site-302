import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { setFeatureFlag } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — souqss" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const { data: flags } = useQuery({
    queryKey: ["admin_flags"],
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("*");
      return data ?? [];
    },
  });

  const get = (k: string) => (flags ?? []).find((r: any) => r.key === k) as any;
  const boostEnabled = !!get("boost_enabled")?.bool_value;
  const rate = Number(get("boost_price_per_view_ngn")?.num_value ?? 2);
  const days = Number(get("boost_max_duration_days")?.num_value ?? 7);

  const [rateInput, setRateInput] = useState(String(rate));
  const [daysInput, setDaysInput] = useState(String(days));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRateInput(String(rate)); setDaysInput(String(days)); }, [rate, days]);

  const { data: orders } = useQuery({
    queryKey: ["admin_boost_orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("boost_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const totalRevenue = (orders ?? [])
    .filter((o: any) => o.status === "paid")
    .reduce((s: number, o: any) => s + Number(o.amount_naira), 0);

  async function toggleBoost(v: boolean) {
    try {
      await setFeatureFlag({ data: { key: "boost_enabled", bool_value: v } });
      qc.invalidateQueries({ queryKey: ["admin_flags"] });
      qc.invalidateQueries({ queryKey: ["feature_flags"] });
      toast.success(`Boost ${v ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function savePricing() {
    setSaving(true);
    try {
      const r = parseFloat(rateInput);
      const d = parseInt(daysInput, 10);
      if (!isFinite(r) || r <= 0) throw new Error("Invalid rate");
      if (!isFinite(d) || d <= 0) throw new Error("Invalid days");
      await setFeatureFlag({ data: { key: "boost_price_per_view_ngn", num_value: r } });
      await setFeatureFlag({ data: { key: "boost_max_duration_days", num_value: d } });
      qc.invalidateQueries({ queryKey: ["admin_flags"] });
      qc.invalidateQueries({ queryKey: ["feature_flags"] });
      toast.success("Pricing saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--ss-green)] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage features and boosted ads</p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[color:var(--ss-gold)]" />
              <div>
                <div className="font-semibold">Boosted ads feature</div>
                <p className="text-xs text-muted-foreground">When OFF, users won't see the "Boost" button anywhere.</p>
              </div>
            </div>
            <Switch checked={boostEnabled} onCheckedChange={toggleBoost} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price per view (₦)</Label>
              <Input type="number" min={0.1} step={0.1} value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Max duration (days)</Label>
              <Input type="number" min={1} step={1} value={daysInput} onChange={(e) => setDaysInput(e.target.value)} />
            </div>
          </div>
          <Button onClick={savePricing} disabled={saving} className="mt-4 bg-[color:var(--ss-green)] hover:opacity-90">
            {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…</> : "Save pricing"}
          </Button>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent boost orders</h2>
            <div className="text-sm text-muted-foreground">Total revenue: <span className="font-bold text-foreground">₦{totalRevenue.toLocaleString()}</span></div>
          </div>
          {(orders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1.5">Date</th><th>Views</th><th>Amount</th><th>Status</th><th>Ref</th></tr>
                </thead>
                <tbody>
                  {(orders ?? []).map((o: any) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-1.5">{new Date(o.created_at).toLocaleString()}</td>
                      <td>{o.views.toLocaleString()}</td>
                      <td>₦{Number(o.amount_naira).toLocaleString()}</td>
                      <td><span className={o.status === "paid" ? "text-green-600 font-medium" : "text-muted-foreground"}>{o.status}</span></td>
                      <td className="font-mono text-[11px]">{o.paystack_reference.slice(0, 18)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
