import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const email = String(body.email ?? "").trim().toLowerCase();
          const password = String(body.password ?? "");
          const full_name = String(body.full_name ?? "");
          const phone = String(body.phone ?? "");
          const whatsapp = String(body.whatsapp ?? "");
          const redirectTo = String(body.redirectTo ?? "");

          if (!email || !password || !full_name) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
          }
          if (password.length < 6) {
            return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Create user (unconfirmed)
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
            user_metadata: { full_name, phone, whatsapp },
          });
          if (createErr || !created.user) {
            return Response.json(
              { error: createErr?.message ?? "Could not create account" },
              { status: 400 },
            );
          }

          // Generate confirmation link
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "signup",
            email,
            password,
            options: { redirectTo: redirectTo || undefined },
          });
          if (linkErr || !linkData?.properties?.action_link) {
            return Response.json(
              { error: linkErr?.message ?? "Could not generate confirmation link" },
              { status: 500 },
            );
          }
          const actionLink = linkData.properties.action_link;

          // Send branded email via Resend gateway
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          const RESEND_API_KEY = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;
          if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
            return Response.json({ error: "Email service not configured" }, { status: 500 });
          }

          const html = buildEmail({ name: full_name, actionLink });
          const text = `Welcome to souqss, ${full_name}!\n\nConfirm your email: ${actionLink}\n\nIf you didn't create this account, ignore this email.`;

          const sendRes = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: "souqss <onboarding@resend.dev>",
              to: [email],
              subject: "Confirm your souqss account",
              html,
              text,
            }),
          });

          if (!sendRes.ok) {
            const errBody = await sendRes.text();
            console.error("Resend send failed", sendRes.status, errBody);
            return Response.json(
              { error: "Could not send confirmation email. Please try again." },
              { status: 502 },
            );
          }

          return Response.json({ ok: true });
        } catch (e) {
          console.error("signup route error", e);
          return Response.json({ error: "Unexpected error" }, { status: 500 });
        }
      },
    },
  },
});

function buildEmail({ name, actionLink }: { name: string; actionLink: string }) {
  const safeName = escapeHtml(name);
  const safeLink = escapeAttr(actionLink);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Confirm your souqss account</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#16a34a 0%,#2563eb 100%);padding:32px 24px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:12px 18px;border-radius:12px;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                  <span style="color:#dcfce7;">souq</span><span style="color:#dbeafe;">ss</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">Welcome${safeName ? `, ${safeName}` : ""} 👋</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
                  Tap the button below to confirm your email and start using <strong style="color:#16a34a;">souq</strong><strong style="color:#2563eb;">ss</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 24px;">
                <a href="${safeLink}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
                  Confirm my email
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link into your browser:</p>
                <p style="margin:0;font-size:12px;color:#2563eb;word-break:break-all;">${safeLink}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  If you didn't create a souqss account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">© souqss — South Sudan's marketplace</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}
