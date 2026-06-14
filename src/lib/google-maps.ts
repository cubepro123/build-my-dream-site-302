// Async Google Maps JS loader. Single-flight, idempotent.
const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loader: Promise<any> | null = null;

export function isMapsConfigured() {
  return Boolean(KEY);
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loader) return loader;
  if (!KEY) return Promise.reject(new Error("Google Maps key not configured"));

  loader = new Promise((resolve, reject) => {
    (window as any).__ssInitMap = () => resolve((window as any).google);
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: KEY,
      loading: "async",
      libraries: "places",
      callback: "__ssInitMap",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loader;
}