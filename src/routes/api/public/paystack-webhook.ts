import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.PAYSTACK_SECRET_KEY;
          if (!secret) return new Response("Not configured", { status: 500 });

          const raw = await request.text();
          const signature = request.headers.get("x-paystack-signature") ?? "";
          const expected = createHmac("sha512", secret).update(raw).digest("hex");
          const sigBuf = Buffer.from(signature);
          const expBuf = Buffer.from(expected);
          if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
            return new Response("Invalid signature", { status: 401 });
          }

          const event = JSON.parse(raw);
          if (event?.event !== "charge.success") return new Response("ignored", { status: 200 });

          const reference: string | undefined = event?.data?.reference;
          const amountKobo: number | undefined = event?.data?.amount;
          if (!reference) return new Response("missing ref", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Find order
          const { data: order } = await supabaseAdmin
            .from("boost_orders")
            .select("*")
            .eq("paystack_reference", reference)
            .maybeSingle();
          if (!order) return new Response("order not found", { status: 404 });
          if ((order as any).status === "paid") return new Response("already paid", { status: 200 });

          // Verify amount
          const expectedKobo = Number((order as any).amount_naira) * 100;
          if (amountKobo !== expectedKobo) {
            await supabaseAdmin
              .from("boost_orders")
              .update({ status: "amount_mismatch" })
              .eq("paystack_reference", reference);
            return new Response("amount mismatch", { status: 400 });
          }

          // Verify with Paystack directly (defense in depth)
          const verify = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secret}` },
          });
          const vBody = await verify.json();
          if (!verify.ok || vBody?.data?.status !== "success") {
            return new Response("verify failed", { status: 400 });
          }

          // Get max duration from flags
          const { data: flagRow } = await supabaseAdmin
            .from("feature_flags")
            .select("num_value")
            .eq("key", "boost_max_duration_days")
            .maybeSingle();
          const days = Number((flagRow as any)?.num_value ?? 7);
          const now = new Date();
          const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

          // Mark paid + activate boost on listing (additive if already boosted)
          await supabaseAdmin
            .from("boost_orders")
            .update({ status: "paid", paid_at: now.toISOString() })
            .eq("paystack_reference", reference);

          const { data: listing } = await supabaseAdmin
            .from("listings")
            .select("boost_status, boost_views_purchased, boost_expires_at")
            .eq("id", (order as any).listing_id)
            .maybeSingle();

          const currentlyActive = (listing as any)?.boost_status === "active";
          const existingPurchased = currentlyActive ? Number((listing as any).boost_views_purchased ?? 0) : 0;
          const existingExpires = currentlyActive && (listing as any)?.boost_expires_at
            ? new Date((listing as any).boost_expires_at)
            : null;
          const newExpires = existingExpires && existingExpires > expires ? existingExpires : expires;

          await supabaseAdmin
            .from("listings")
            .update({
              boost_status: "active",
              boost_views_purchased: existingPurchased + (order as any).views,
              boost_started_at: currentlyActive ? undefined : now.toISOString(),
              boost_expires_at: newExpires.toISOString(),
            })
            .eq("id", (order as any).listing_id);

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("paystack webhook error", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
