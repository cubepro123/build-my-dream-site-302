import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "crypto";

const GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "souqss <notifications@souqss.tech>";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 s
const MAX_ATTEMPTS = 6;

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");
}

function safeEqHex(a: string, b: string) {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  return A.length === B.length && timingSafeEqual(A, B);
}

async function sendOtpEmail(to: string, code: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Email service is not configured");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
      <tr><td style="background:linear-gradient(135deg,#0a8754 0%,#1f6feb 100%);padding:28px;color:#fff;text-align:center">
        <div style="font-size:26px;font-weight:800;letter-spacing:-.01em">souq<span style="color:#fbbf24">ss</span></div>
        <div style="font-size:13px;opacity:.9;margin-top:4px">South Sudan's Marketplace 🇸🇸</div>
      </td></tr>
      <tr><td style="padding:32px 28px;text-align:center">
        <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">Confirm your email</h1>
        <p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.55">Enter this 6-digit code in souqss to finish creating your account. It expires in 10 minutes.</p>
        <div style="display:inline-block;padding:18px 28px;background:linear-gradient(135deg,rgba(10,135,84,.08),rgba(31,111,235,.08));border:2px solid #0a8754;border-radius:14px;font-size:36px;font-weight:800;letter-spacing:12px;color:#0a8754;font-family:'SF Mono',Menlo,Consolas,monospace">${code}</div>
        <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.5">If you didn't try to create a souqss account, you can safely ignore this email.</p>
      </td></tr>
      <tr><td style="padding:14px 28px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center;border-top:1px solid #e2e8f0">
        souqss · hellosouqss@gmail.com
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `${code} is your souqss confirmation code`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("OTP email send failed", { status: res.status, body: text.slice(0, 300) });
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
}

export const sendSignupOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(254) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();

    // Cooldown to prevent spam
    const { data: existing } = await supabaseAdmin
      .from("email_otps")
      .select("last_sent_at")
      .eq("email", email)
      .maybeSingle();
    if (existing?.last_sent_at) {
      const diff = Date.now() - new Date(existing.last_sent_at).getTime();
      if (diff < RESEND_COOLDOWN_MS) {
        return { ok: false, cooldownMs: RESEND_COOLDOWN_MS - diff };
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const code_hash = hashCode(email, code);
    const expires_at = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin.from("email_otps").upsert({
      email,
      code_hash,
      expires_at,
      attempts: 0,
      consumed_at: null,
      last_sent_at: now,
    });
    if (error) {
      console.error("OTP save failed", { message: error.message });
      throw new Error(error.message);
    }

    await sendOtpEmail(email, code);
    return { ok: true };
  });

export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(254), code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();

    const { data: row } = await supabaseAdmin
      .from("email_otps")
      .select("code_hash, expires_at, attempts, consumed_at")
      .eq("email", email)
      .maybeSingle();
    if (!row) return { ok: false, reason: "no_code" as const };
    if (row.consumed_at) return { ok: false, reason: "already_used" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" as const };
    if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" as const };

    const expected = hashCode(email, data.code);
    if (!safeEqHex(expected, row.code_hash)) {
      await supabaseAdmin
        .from("email_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("email", email);
      return { ok: false, reason: "wrong_code" as const, remaining: MAX_ATTEMPTS - row.attempts - 1 };
    }

    // Find the unconfirmed user and confirm them
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false, reason: "no_user" as const };

    if (!user.email_confirmed_at) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    }

    await supabaseAdmin
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", email);

    return { ok: true };
  });
