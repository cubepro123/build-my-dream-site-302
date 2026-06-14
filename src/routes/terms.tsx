import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — souqss" }, { name: "description", content: "souqss terms of service governing use of the marketplace." }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Back home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Terms & Conditions</h1>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-4 py-8 prose prose-sm prose-neutral max-w-none">
        <h1>TERMS &amp; CONDITIONS</h1>
        <p><em>Updated June 6, 2026</em></p>

        <h2>General Terms</h2>
        <p>By accessing souqss, you agree to be bound by these Terms. Under no circumstances shall the souqss team be liable for any direct, indirect, special, incidental or consequential damages, including loss of data or profit, arising out of the use or inability to use the materials on this site.</p>

        <h2>License</h2>
        <p>souqss grants you a revocable, non-exclusive, non-transferable, limited license to use the website strictly in accordance with these Terms.</p>

        <h2>Definitions</h2>
        <ul>
          <li><strong>Company / we / us:</strong> souqss.</li>
          <li><strong>Country:</strong> South Sudan.</li>
          <li><strong>Service:</strong> the service provided by souqss as described on this platform.</li>
          <li><strong>Website:</strong> souqss.tech.</li>
          <li><strong>You:</strong> a registered user of souqss.</li>
        </ul>

        <h2>Restrictions</h2>
        <p>You agree not to license, sell, rent, lease, distribute, host, or commercially exploit the website; modify, reverse engineer, or create derivative works of any part of the website; or remove proprietary notices.</p>

        <h2>Payment</h2>
        <p>If you pay for a one-time plan, you agree to pay all fees in accordance with the billing terms in effect when each fee is due. souqss reserves the right to change prices and billing methods.</p>

        <h2>Return and Refund Policy</h2>
        <p>If you are not completely satisfied with a good or service provided through souqss, please contact us so we can discuss the issue.</p>

        <h2>Your Suggestions</h2>
        <p>Any feedback or suggestions you provide remain the property of souqss to use as we see fit.</p>

        <h2>Links to Other Websites</h2>
        <p>souqss may contain links to other websites we do not control. We are not responsible for the content or policies of these sites.</p>

        <h2>Cookies</h2>
        <p>souqss uses Cookies to enhance the performance and functionality of the website. We never place Personally Identifiable Information in Cookies.</p>

        <h2>Changes</h2>
        <p>souqss may modify these Terms at any time. Continued use after changes become effective constitutes acceptance.</p>

        <h2>No Warranties</h2>
        <p>The website is provided “AS IS” and “AS AVAILABLE” without warranty of any kind, to the maximum extent permitted by law.</p>

        <h2>Limitation of Liability</h2>
        <p>Notwithstanding any damages you might incur, the entire liability of souqss shall be limited to the amount actually paid by you for the website (if any).</p>

        <h2>Dispute Resolution</h2>
        <p>In the event of a dispute, contact us via email at <a href="mailto:hello@souqss.tech">hello@souqss.tech</a> and we will attempt informal resolution within 60 days before any further action.</p>

        <h2>Contact</h2>
        <p>Email: <a href="mailto:hellosouqss@gmail.com">hellosouqss@gmail.com</a></p>
      </main>
    </div>
  );
}