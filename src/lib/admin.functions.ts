import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const flagSchema = z.object({
  key: z.string().min(1),
  bool_value: z.boolean().nullable().optional(),
  num_value: z.number().nullable().optional(),
});

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => flagSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const payload: any = { key: data.key, updated_at: new Date().toISOString() };
    if (data.bool_value !== undefined) payload.bool_value = data.bool_value;
    if (data.num_value !== undefined) payload.num_value = data.num_value;
    const { error } = await supabase.from("feature_flags").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get user email
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userRes.user?.email) throw new Error("Could not load account");
    const email = userRes.user.email;

    // Get full name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const fullName = profile?.full_name ?? "";

    // Create token (1hr expiry)
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: tokErr } = await supabaseAdmin
      .from("account_deletion_tokens")
      .insert({ token, user_id: userId, expires_at: expiresAt });
    if (tokErr) throw new Error(tokErr.message);

    // Build link
    const origin =
      process.env.SITE_URL ||
      `https://project--7e25b3fe-4e4d-40be-baa7-1cd16dd8db72.lovable.app`;
    const confirmLink = `${origin}/delete-account?token=${token}`;

    // Send email
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("Email service not configured");

    const html = buildDeletionEmail({ name: fullName, confirmLink });
    const text = `Hi${fullName ? " " + fullName : ""},\n\nYou requested to delete your souqss account. Confirm here (link expires in 1 hour):\n${confirmLink}\n\nIf you didn't request this, ignore this email.`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "souqss <onboarding@resend.dev>",
        to: [email],
        subject: "Confirm souqss account deletion",
        html,
        text,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("deletion email send failed", res.status, t);
      throw new Error("Could not send confirmation email");
    }
    return { ok: true };
  });

function buildDeletionEmail({ name, confirmLink }: { name: string; confirmLink: string }) {
  const safeName = (name || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const safeLink = confirmLink.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#16a34a 100%);padding:32px 24px;text-align:center;">
<div style="display:inline-block;background:rgba(255,255,255,0.18);padding:12px 18px;border-radius:12px;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#fff;">souqss</div>
</td></tr>
<tr><td style="padding:36px 32px 8px;">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">Delete your account${safeName ? `, ${safeName}` : ""}?</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">You asked to delete your <strong style="color:#16a34a;">souq</strong><strong style="color:#2563eb;">ss</strong> account. This will <strong>permanently erase</strong> your profile, listings, messages and ratings. This cannot be undone.</p>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">The confirmation link expires in <strong>1 hour</strong>.</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 24px;">
<a href="${safeLink}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">Yes, delete my account</a>
</td></tr>
<tr><td style="padding:0 32px 28px;"><p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link:</p><p style="margin:0;font-size:12px;color:#2563eb;word-break:break-all;">${safeLink}</p></td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;"><p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">If you didn't request this, ignore this email — nothing will happen.</p></td></tr>
</table></td></tr></table></body></html>`;
}
