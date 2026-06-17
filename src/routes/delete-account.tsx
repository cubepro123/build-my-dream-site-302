import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [{ title: "Confirm account deletion — souqss" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: DeleteConfirmPage,
});

function DeleteConfirmPage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"idle" | "deleting" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function confirm() {
    if (!token) { setErr("Missing token"); setState("error"); return; }
    setState("deleting");
    try {
      const res = await fetch("/api/public/account-deletion-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      await supabase.auth.signOut().catch(() => {});
      setState("done");
    } catch (e: any) {
      setErr(e.message ?? "Could not delete account");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)] text-center">
          {state === "done" ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="mt-3 text-xl font-bold">Account deleted</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your account and all data have been permanently removed.</p>
              <Link to="/"><Button className="mt-5 bg-[color:var(--ss-green)] hover:opacity-90">Back to home</Button></Link>
            </>
          ) : state === "error" ? (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
              <h1 className="mt-3 text-xl font-bold">Can't delete</h1>
              <p className="mt-2 text-sm text-muted-foreground">{err}</p>
              <Link to="/"><Button variant="outline" className="mt-5">Go home</Button></Link>
            </>
          ) : (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
              <h1 className="mt-3 text-xl font-bold">Confirm account deletion</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This will <strong>permanently erase</strong> your profile, listings, messages and ratings. This cannot be undone.
              </p>
              <Button
                onClick={confirm}
                disabled={state === "deleting"}
                className="mt-5 w-full bg-red-600 hover:bg-red-700"
              >
                {state === "deleting" ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Deleting…</> : "Yes, delete my account"}
              </Button>
              <Link to="/"><Button variant="ghost" className="mt-2 w-full">Cancel</Button></Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
