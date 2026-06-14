import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContactEmail } from "@/lib/email.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact us — souqss" },
    { name: "description", content: "Get in touch with the souqss team. We reply within 1 business day." },
  ] }),
  component: ContactPage,
});

function ContactPage() {
  const send = useServerFn(sendContactEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await send({ data: {
        name: String(f.get("name") || "").trim(),
        email: String(f.get("email") || "").trim(),
        message: String(f.get("message") || "").trim(),
      }});
      setSent(true);
      (e.target as HTMLFormElement).reset();
      toast.success("Message sent! Check your inbox for confirmation.");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back home</Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--ss-blue)]/10 text-[color:var(--ss-blue)]"><Mail className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold">Contact us</h1>
            <p className="text-sm text-muted-foreground">We reply within 1 business day.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Your name</Label>
            <Input id="c-name" name="name" required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-msg">Message</Label>
            <Textarea id="c-msg" name="message" required minLength={5} maxLength={4000} rows={6} placeholder="How can we help?" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
            {loading ? "Sending…" : "Send message"}
          </Button>
          {sent && <p className="text-center text-xs text-muted-foreground">A confirmation email is on its way to your inbox.</p>}
        </form>
      </main>
    </div>
  );
}