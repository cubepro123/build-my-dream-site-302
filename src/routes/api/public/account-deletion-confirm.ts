import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/account-deletion-confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const token = String(body?.token ?? "");
          if (!token || token.length < 16) {
            return Response.json({ error: "Invalid token" }, { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: row, error } = await supabaseAdmin
            .from("account_deletion_tokens")
            .select("*")
            .eq("token", token)
            .maybeSingle();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          if (!row) return Response.json({ error: "Token not found" }, { status: 404 });
          if ((row as any).used_at) return Response.json({ error: "Token already used" }, { status: 400 });
          if (new Date((row as any).expires_at).getTime() < Date.now()) {
            return Response.json({ error: "Token expired" }, { status: 400 });
          }

          const userId = (row as any).user_id as string;

          // Mark used first (idempotency)
          await supabaseAdmin
            .from("account_deletion_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("token", token);

          // Delete user — FK cascades from auth.users handle profile/listings/etc.
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (delErr) {
            console.error("deleteUser failed", delErr);
            return Response.json({ error: "Could not delete account" }, { status: 500 });
          }
          return Response.json({ ok: true });
        } catch (e) {
          console.error("account-deletion-confirm error", e);
          return Response.json({ error: "Unexpected error" }, { status: 500 });
        }
      },
    },
  },
});
