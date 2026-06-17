import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const initSchema = z.object({
  listing_id: z.string().uuid(),
  views: z.number().int().min(50).max(1_000_000),
});

export const initBoostOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => initSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Must own the listing
    const { data: listing, error: lErr } = await supabase
      .from("listings")
      .select("id, seller_id, title")
      .eq("id", data.listing_id)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!listing) throw new Error("Listing not found");
    if (listing.seller_id !== userId) throw new Error("Not your listing");

    // Check flag + rate
    const { data: flags } = await supabase.from("feature_flags").select("*");
    const flagMap = new Map((flags ?? []).map((r: any) => [r.key, r]));
    const enabled = !!(flagMap.get("boost_enabled") as any)?.bool_value;
    const rate = Number((flagMap.get("boost_price_per_view_ngn") as any)?.num_value ?? 2);
    if (!enabled) throw new Error("Boost is currently disabled");

    const amount_naira = Math.ceil(data.views * rate);
    const reference = `boost_${data.listing_id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { error: ordErr } = await supabase.from("boost_orders").insert({
      listing_id: data.listing_id,
      user_id: userId,
      views: data.views,
      amount_naira,
      paystack_reference: reference,
      status: "pending",
    });
    if (ordErr) throw new Error(ordErr.message);

    // Get user email for Paystack
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? "buyer@souqss.app";

    return {
      reference,
      amount_naira,
      amount_kobo: amount_naira * 100,
      email,
      listing_title: listing.title,
    };
  });

// Public increment of delivered views (called on listing detail open)
export const incrementBoostView = createServerFn({ method: "POST" })
  .inputValidator((input: { listing_id: string }) =>
    z.object({ listing_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("boost_status, boost_views_purchased, boost_views_delivered, boost_expires_at")
      .eq("id", data.listing_id)
      .maybeSingle();
    if (!listing || (listing as any).boost_status !== "active") return { ok: false };
    const delivered = ((listing as any).boost_views_delivered ?? 0) + 1;
    const purchased = (listing as any).boost_views_purchased ?? 0;
    const expired = (listing as any).boost_expires_at
      ? new Date((listing as any).boost_expires_at).getTime() <= Date.now()
      : false;
    const done = delivered >= purchased || expired;
    const update: any = { boost_views_delivered: delivered };
    if (done) update.boost_status = "expired";
    await supabaseAdmin.from("listings").update(update).eq("id", data.listing_id);
    return { ok: true };
  });
