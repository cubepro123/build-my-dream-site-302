import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Store, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — souqss" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading && !sentTo) navigate({ to: "/" });
  }, [user, loading, sentTo, navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("not confirmed")) {
        return toast.error("Please confirm your email first — check your inbox for the confirmation link.");
      }
      return toast.error(error.message);
    }
    toast.success("Welcome back!");
    navigate({ to: "/" });
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    setLoading(true);
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: String(f.get("password")),
          full_name: String(f.get("full_name")),
          phone: String(f.get("phone") || ""),
          whatsapp: String(f.get("whatsapp") || ""),
          redirectTo: `${window.location.origin}/`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      await supabase.auth.signOut();
      setLoading(false);
      if (!res.ok) return toast.error(data?.error || "Could not create account");
      setSentTo(email);
    } catch {
      setLoading(false);
      toast.error("Network error. Try again.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--shadow-elevated)]">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-lg">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--ss-green)] text-primary-foreground">
            <Store className="h-5 w-5" />
          </span>
          <span>
            <span className="text-[color:var(--ss-green)]">souq</span>
            <span className="text-[color:var(--ss-blue)]">ss</span>
          </span>
        </Link>

        {sentTo ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--ss-blue)]/10">
              <Mail className="h-7 w-7 text-[color:var(--ss-blue)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a confirmation link to<br />
                <span className="font-medium text-foreground">{sentTo}</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Click the link in the email, then come back here to sign in.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSentTo(null)}
              className="w-full"
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
                <div className="text-center text-xs">
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-[color:var(--ss-blue)] hover:underline">Forgot password?</Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" name="full_name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" name="email" type="email" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-phone">Phone</Label>
                    <Input id="su-phone" name="phone" placeholder="+211…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-wa">WhatsApp</Label>
                    <Input id="su-wa" name="whatsapp" placeholder="+211…" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
