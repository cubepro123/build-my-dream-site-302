import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "souqss <notifications@souqss.tech>";
const NOTIFY_INBOX = "hellosouqss@gmail.com";

async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Email service is not configured");
  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.reply_to,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fa;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)">
        <tr><td style="background:linear-gradient(135deg,#0a8754,#1f6feb);padding:24px 28px;color:#fff">
          <div style="font-size:22px;font-weight:800;letter-spacing:-.01em">souq<span style="color:#fbbf24">ss</span></div>
          <div style="font-size:13px;opacity:.85;margin-top:2px">South Sudan's Marketplace 🇸🇸</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
          You're receiving this because you have an account on souqss. Reach us at hellosouqss@gmail.com.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ to: z.string().email(), name: z.string().max(120).optional() }))
  .handler(async ({ data }) => {
    const first = (data.name ?? "there").split(/\s+/)[0];
    await sendEmail({
      to: data.to,
      subject: "Welcome to souqss 🎉",
      html: shell(
        `Welcome, ${escapeHtml(first)}!`,
        `<p style="margin:0 0 14px;line-height:1.55">Your souqss account is ready. You can now post listings, chat with buyers and sellers, and book services across South Sudan.</p>
         <p style="margin:0 0 18px;line-height:1.55">Tap below to post your first ad — it's free.</p>
         <p style="margin:0 0 18px"><a href="https://south-sudans-marketplace.lovable.app/sell" style="display:inline-block;background:#0a8754;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Post a free ad</a></p>
         <p style="margin:0;color:#64748b;font-size:13px">Reply to this email if you need help.</p>`,
      ),
    });
    return { ok: true };
  });

export const sendContactEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    message: z.string().min(5).max(4000),
  }))
  .handler(async ({ data }) => {
    const safeName = escapeHtml(data.name);
    const safeMsg = escapeHtml(data.message).replace(/\n/g, "<br>");
    // 1) auto-reply to sender
    await sendEmail({
      to: data.email,
      subject: "We got your message — souqss",
      html: shell(
        `Thanks, ${safeName}!`,
        `<p style="margin:0 0 14px;line-height:1.55">We've received your message and a human will reply within 1 business day.</p>
         <p style="margin:0 0 8px;color:#475569;font-size:13px">Your message:</p>
         <blockquote style="margin:0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #0a8754;border-radius:6px;color:#334155;font-size:14px">${safeMsg}</blockquote>`,
      ),
    });
    // 2) notify inbox
    await sendEmail({
      to: NOTIFY_INBOX,
      reply_to: data.email,
      subject: `New contact: ${data.name}`,
      html: shell(
        `New contact form submission`,
        `<p style="margin:0 0 6px"><strong>From:</strong> ${safeName} &lt;${escapeHtml(data.email)}&gt;</p>
         <p style="margin:0 0 14px"><strong>Message:</strong></p>
         <blockquote style="margin:0;padding:12px 14px;background:#f1f5f9;border-left:3px solid #1f6feb;border-radius:6px;color:#334155;font-size:14px">${safeMsg}</blockquote>`,
      ),
    });
    return { ok: true };
  });

export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), redirectTo: z.string().url() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: data.redirectTo },
    });
    if (error) {
      // Don't leak whether the email exists; pretend success
      return { ok: true };
    }
    const action = link?.properties?.action_link;
    if (!action) return { ok: true };
    await sendEmail({
      to: data.email,
      subject: "Reset your souqss password",
      html: shell(
        `Reset your password`,
        `<p style="margin:0 0 14px;line-height:1.55">Someone (hopefully you) asked to reset the password for your souqss account. Tap the button below to set a new one. The link expires in 1 hour.</p>
         <p style="margin:0 0 18px"><a href="${escapeAttr(action)}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Reset password</a></p>
         <p style="margin:0;color:#64748b;font-size:13px">If you didn't ask for this, you can ignore this email — your password stays the same.</p>`,
      ),
    });
    return { ok: true };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string) { return escapeHtml(s); }