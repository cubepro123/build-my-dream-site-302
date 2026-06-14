/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Maximize2 } from "lucide-react";
import { loadGoogleMaps, isMapsConfigured } from "@/lib/google-maps";

type Props = {
  lat: number;
  lng: number;
  label?: string;
  address?: string | null;
  height?: number;
};

export function MapView({ lat, lng, label, address, height = 220 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!isMapsConfigured()) {
      setErr("Map unavailable");
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        new google.maps.Marker({ map, position: { lat, lng }, title: label });
        setLoading(false);
      })
      .catch((e) => {
        setErr(e?.message ?? "Map failed");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, label]);

  function zoomInSite() {
    mapRef.current?.setCenter({ lat, lng });
    mapRef.current?.setZoom(17);
    setZoomed(true);
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-muted" style={{ height }}>
        <div ref={ref} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          </div>
        )}
        {err && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            {err}
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 text-[12px]">
        <div className="flex min-w-0 items-start gap-1 text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</span>
        </div>
        <button
          type="button"
          onClick={zoomInSite}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[color:var(--ss-green)] px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
        >
          {zoomed ? "Pinned" : "View map"} <Maximize2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
