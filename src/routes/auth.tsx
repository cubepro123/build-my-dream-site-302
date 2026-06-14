import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Store, MailCheck, RefreshCw, Loader2 } from "lucide-react";
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
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  // Auto-poll for email confirmation while waiting
  useEffect(() => {
    if (!pendingEmail) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase.auth.refreshSession();
      if (cancelled) return;
      if (data.session) {
        toast.success("Email confirmed — welcome!");
        navigate({ to: "/" });
      }
    };
    pollRef.current = window.setInterval(tick, 3000) as unknown as number;
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [pendingEmail, navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/" });
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const fullName = String(f.get("full_name"));
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(f.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          phone: String(f.get("phone") || ""),
          whatsapp: String(f.get("whatsapp") || ""),
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      // Auto-confirm is on — straight in
      toast.success("Account created — you're signed in!");
      navigate({ to: "/" });
      return;
    }
    // Email confirmation required
    setPendingEmail(email);
  }

  async function checkConfirmed() {
    setChecking(true);
    // Pull the latest session state from storage in case another tab confirmed
    const { data: sData } = await supabase.auth.getSession();
    if (sData.session) {
      toast.success("Email confirmed — welcome!");
      navigate({ to: "/" });
      return;
    }
    // Force refresh in case Supabase has a fresh token but state is stale
    const { data: refreshed } = await supabase.auth.refreshSession();
    setChecking(false);
    if (refreshed.session) {
      toast.success("Email confirmed — welcome!");
      navigate({ to: "/" });
      return;
    }
    toast.error("Still not confirmed. Open the email and tap the confirm link.");
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return toast.error(error.message);
    toast.success("Confirmation email resent");
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

        {pendingEmail ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--ss-green)]/10 text-[color:var(--ss-green)]">
              <MailCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Confirm your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We just sent a confirmation link to <span className="font-semibold text-foreground">{pendingEmail}</span>.
                Tap the link, then come back here.
              </p>
            </div>
            <Button
              onClick={checkConfirmed}
              disabled={checking}
              className="w-full bg-[color:var(--ss-green)] hover:opacity-90"
            >
              {checking ? "Checking…" : "I confirmed my email"}
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs">
              <button
                onClick={resendConfirmation}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-[color:var(--ss-blue)] hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Resend email
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                onClick={() => setPendingEmail(null)}
                className="text-muted-foreground hover:text-[color:var(--ss-blue)] hover:underline"
              >
                Use a different email
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Check your spam folder if you don't see it.</p>
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
