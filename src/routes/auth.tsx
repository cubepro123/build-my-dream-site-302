import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Store, Mail, Loader2, CheckCircle2, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — souqss" }] }),
  component: AuthPage,
});

type SignupStep = "form" | "sending" | "otp" | "confirmed" | "welcome";

type SignupOtpResponse = {
  ok: boolean;
  reason?: "invalid_request" | "server_error" | "no_code" | "already_used" | "expired" | "too_many_attempts" | "wrong_code" | "no_user";
  cooldownMs?: number;
  remaining?: number;
};

async function requestSignupOtp(payload: { action: "send"; email: string } | { action: "verify"; email: string; code: string }) {
  const res = await fetch("/api/public/signup-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as SignupOtpResponse;
  if (!res.ok) throw new Error(data.reason === "server_error" ? "Couldn't send the code" : "Invalid confirmation request");
  return data;
}

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Signup OTP flow state
  const [step, setStep] = useState<SignupStep>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Only auto-redirect signed-in users when not in the middle of the signup OTP flow
    if (user && !loading && step === "form") navigate({ to: "/" });
  }, [user, loading, step, navigate]);

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
        return toast.error("Please confirm your email first. Create the account again to get a new code.");
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
    const password = String(f.get("password"));
    const fullName = String(f.get("full_name"));
    setPendingEmail(email);
    setPendingPassword(password);
    setPendingName(fullName);
    setStep("sending");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: String(f.get("phone") || ""),
          whatsapp: String(f.get("whatsapp") || ""),
        },
      },
    });
    // If a session somehow got created (e.g. auto-confirm), kill it — no entry without code.
    await supabase.auth.signOut();

    if (error && !error.message.toLowerCase().includes("already registered") && !error.message.toLowerCase().includes("already been registered")) {
      setStep("form");
      return toast.error(error.message);
    }

    try {
      const res = await requestSignupOtp({ action: "send", email });
      if (!res.ok) {
        toast.error(`Please wait ${Math.ceil((res.cooldownMs ?? 30000) / 1000)}s before requesting another code.`);
      }
    } catch (err) {
      setStep("form");
      return toast.error(err instanceof Error ? err.message : "Couldn't send the code");
    }
    setStep("otp");
  }

  async function handleVerify(value: string) {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const res = await requestSignupOtp({ action: "verify", email: pendingEmail, code: value });
      if (!res.ok) {
        setVerifying(false);
        setCode("");
        const reason = res.reason;
        if (reason === "wrong_code") return toast.error(`Wrong code. ${res.remaining ?? 0} tries left.`);
        if (reason === "expired") return toast.error("Code expired. Tap Resend.");
        if (reason === "too_many_attempts") return toast.error("Too many attempts. Tap Resend for a new code.");
        if (reason === "already_used") return toast.error("This code was already used.");
        return toast.error("Couldn't verify that code.");
      }
      setStep("confirmed");
      // Now sign them in with their password
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword,
      });
      if (siErr) {
        setVerifying(false);
        setStep("form");
        return toast.error(siErr.message);
      }
      // Short pause to show the "Confirmed" state then welcome
      setTimeout(() => setStep("welcome"), 900);
      setTimeout(() => navigate({ to: "/" }), 2200);
    } catch (err) {
      setVerifying(false);
      setCode("");
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      const res = await requestSignupOtp({ action: "send", email: pendingEmail });
      if (!res.ok) {
        toast.error(`Please wait ${Math.ceil((res.cooldownMs ?? 30000) / 1000)}s before requesting another code.`);
      } else {
        toast.success("New code sent.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend");
    }
    setResending(false);
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

        {step === "form" && (
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
                <Button type="submit" className="w-full bg-[color:var(--ss-green)] hover:opacity-90">
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="relative grid h-24 w-24 place-items-center">
              <Loader2 className="absolute inset-0 h-24 w-24 animate-spin text-[color:var(--ss-green)]" strokeWidth={1.5} />
              <Mail className="h-10 w-10 text-[color:var(--ss-blue)]" />
            </div>
            <h2 className="text-lg font-semibold">Sending your code…</h2>
            <p className="text-sm text-muted-foreground">We're emailing a 6-digit code to <span className="font-medium text-foreground">{pendingEmail}</span></p>
          </div>
        )}

        {step === "otp" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--ss-blue)]/10">
              <Mail className="h-7 w-7 text-[color:var(--ss-blue)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code we sent to<br /><span className="font-medium text-foreground">{pendingEmail}</span></p>
            </div>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (v.length === 6) handleVerify(v);
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
            {verifying && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || verifying}
                className="text-[color:var(--ss-blue)] hover:underline disabled:opacity-50"
              >
                {resending ? "Resending…" : "Resend code"}
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={() => { setStep("form"); setCode(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {step === "confirmed" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-[color:var(--ss-green)]/10 animate-in zoom-in duration-300">
              <CheckCircle2 className="h-14 w-14 text-[color:var(--ss-green)]" />
            </div>
            <h2 className="text-xl font-semibold">Confirmed!</h2>
            <p className="text-sm text-muted-foreground">Setting up your account…</p>
          </div>
        )}

        {step === "welcome" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[color:var(--ss-green)] to-[color:var(--ss-blue)] animate-in zoom-in duration-300">
              <PartyPopper className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold">
              Welcome to <span className="text-[color:var(--ss-green)]">souq</span><span className="text-[color:var(--ss-blue)]">ss</span>
              {pendingName ? `, ${pendingName.split(/\s+/)[0]}!` : "!"}
            </h2>
            <p className="text-sm text-muted-foreground">Taking you home…</p>
          </div>
        )}
      </div>
    </div>
  );
}
