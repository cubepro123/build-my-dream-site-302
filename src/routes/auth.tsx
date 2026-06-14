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
import { sendSignupOtp, verifySignupOtp } from "@/lib/otp.functions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — souqss" }] }),
  component: AuthPage,
});

type Pending = { email: string; password: string } | null;

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    tickRef.current = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000) as unknown as number;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [resendIn]);

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
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    const fullName = String(f.get("full_name"));
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          phone: String(f.get("phone") || ""),
          whatsapp: String(f.get("whatsapp") || ""),
        },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data.session) {
      // Auto-confirm enabled — just go in
      setLoading(false);
      toast.success("Account created!");
      navigate({ to: "/" });
      return;
    }
    // Send our own 6-digit code via Resend
    try {
      const res = await sendSignupOtp({ data: { email } });
      setLoading(false);
      if (!res.ok && res.cooldownMs) {
        setResendIn(Math.ceil(res.cooldownMs / 1000));
      } else {
        setResendIn(30);
      }
      setPending({ email, password });
      setCode("");
      toast.success("We sent you a 6-digit code");
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message ?? "Couldn't send confirmation code");
    }
  }

  async function submitCode(value?: string) {
    if (!pending) return;
    const c = (value ?? code).trim();
    if (!/^\d{6}$/.test(c)) return;
    setVerifying(true);
    try {
      const res = await verifySignupOtp({ data: { email: pending.email, code: c } });
      if (!res.ok) {
        setVerifying(false);
        const msg: Record<string, string> = {
          wrong_code: "Wrong code. Try again.",
          expired: "Code expired. Tap resend.",
          already_used: "Code already used.",
          too_many_attempts: "Too many tries. Tap resend.",
          no_code: "Send a new code first.",
          no_user: "Account not found. Sign up again.",
        };
        toast.error(msg[res.reason] ?? "Couldn't verify code");
        setCode("");
        return;
      }
      // Confirmed — now sign in
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: pending.email,
        password: pending.password,
      });
      setVerifying(false);
      if (siErr) return toast.error(siErr.message);
      toast.success("Welcome to souqss!");
      navigate({ to: "/" });
    } catch (err: any) {
      setVerifying(false);
      toast.error(err?.message ?? "Verification failed");
    }
  }

  async function resendCode() {
    if (!pending || resendIn > 0) return;
    try {
      const res = await sendSignupOtp({ data: { email: pending.email } });
      if (!res.ok && res.cooldownMs) {
        setResendIn(Math.ceil(res.cooldownMs / 1000));
        toast.info("Please wait a moment before resending");
      } else {
        setResendIn(30);
        toast.success("New code sent");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't resend");
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

        {pending ? (
          <div className="space-y-5 pt-2 text-center">
            <div className="relative mx-auto h-20 w-20">
              {verifying ? (
                <Loader2 className="absolute inset-0 m-auto h-20 w-20 animate-spin text-[color:var(--ss-green)]" strokeWidth={1.25} />
              ) : (
                <div className="absolute inset-0 rounded-full border-2 border-[color:var(--ss-green)]/20" />
              )}
              <MailCheck className="absolute inset-0 m-auto h-8 w-8 text-[color:var(--ss-green)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Confirm your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a 6-digit code to <span className="font-semibold text-foreground">{pending.email}</span>.
              </p>
            </div>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) submitCode(v);
                }}
                disabled={verifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              onClick={() => submitCode()}
              disabled={verifying || code.length !== 6}
              className="w-full bg-[color:var(--ss-green)] hover:opacity-90"
            >
              {verifying ? "Verifying…" : "Confirm & sign in"}
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={resendCode}
                disabled={resendIn > 0}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-[color:var(--ss-blue)] hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw className="h-3 w-3" /> {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setCode("");
                }}
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
