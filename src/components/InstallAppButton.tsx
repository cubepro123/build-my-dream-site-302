import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosTip, setIosTip] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("ss_install_dismissed") === "1") return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    const onInstalled = () => { setInstalled(true); setShow(false); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no prompt — show a hint instead
    if (isIos() && !isStandalone()) setShow(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !show) return null;

  function dismiss() {
    setShow(false);
    try { sessionStorage.setItem("ss_install_dismissed", "1"); } catch {}
  }

  async function install() {
    if (isIos()) { setIosTip(true); return; }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setShow(false);
  }

  return (
    <>
      <div className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 sm:bottom-4">
        <div className="flex items-center gap-2 rounded-full border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--ss-green)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> Install app
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {iosTip && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setIosTip(false)}>
          <div className="max-w-xs rounded-2xl bg-card p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[color:var(--ss-green)]/10 text-[color:var(--ss-green)]">
              <Share className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Add to Home Screen</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap <strong>Share</strong> in Safari, then choose <strong>"Add to Home Screen"</strong> to install souqss like a real app.
            </p>
            <button onClick={() => setIosTip(false)} className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-[color:var(--ss-green)] px-4 text-xs font-semibold text-white">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}