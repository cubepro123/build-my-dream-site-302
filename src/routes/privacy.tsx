import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — souqss" }, { name: "description", content: "How souqss collects, uses, and protects your personal information." }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Back home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-4 py-8 prose prose-sm prose-neutral max-w-none">
        <h1>PRIVACY POLICY</h1>
        <p><em>Updated June 6, 2026</em></p>
        <p>souqss respects your privacy. This Privacy Policy explains what personal information we collect, how we use it, and the choices you have.</p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Account information:</strong> name, email, phone, WhatsApp number, and location you provide when registering.</li>
          <li><strong>Listings &amp; messages:</strong> the ads you post, images you upload, and messages you exchange with other users.</li>
          <li><strong>Usage data:</strong> pages viewed, device, browser, and approximate location, collected automatically.</li>
          <li><strong>Cookies:</strong> small files used to keep you signed in and improve performance.</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To operate the marketplace, display your listings, and connect buyers with sellers.</li>
          <li>To enable chat, calls, and booking requests between users.</li>
          <li>To send service emails (account confirmation, password reset, notifications).</li>
          <li>To prevent fraud, abuse, and to enforce our Terms.</li>
        </ul>

        <h2>Sharing</h2>
        <p>We do not sell your personal data. We share information only with:</p>
        <ul>
          <li>Other users when you choose to make contact (e.g. seller sees buyer's message or callback request).</li>
          <li>Service providers that help us run souqss (hosting, email delivery, analytics) under appropriate confidentiality.</li>
          <li>Authorities when required by law.</li>
        </ul>

        <h2>Your Rights</h2>
        <p>You can update your profile, delete your listings, or request account deletion at any time by contacting us. You may opt out of non-essential cookies through your browser settings.</p>

        <h2>Children</h2>
        <p>souqss is not directed to children under 13. We do not knowingly collect data from children.</p>

        <h2>Security</h2>
        <p>We use industry-standard safeguards to protect your data, but no method of transmission over the Internet is 100% secure.</p>

        <h2>Changes</h2>
        <p>We may update this Privacy Policy. Material changes will be posted on this page with an updated date.</p>

        <h2>Contact</h2>
        <p>Questions about your privacy? Email <a href="mailto:hellosouqss@gmail.com">hellosouqss@gmail.com</a>.</p>
      </main>
    </div>
  );
}