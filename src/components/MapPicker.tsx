/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { loadGoogleMaps, isMapsConfigured } from "@/lib/google-maps";

type MapValue = { lat: number; lng: number; address?: string; placeId?: string };

type Props = {
  value?: MapValue | null;
  onChange: (v: MapValue & { address: string }) => void;
  height?: number;
};

const DEFAULT_CENTER = { lat: 4.8594, lng: 31.5713 };

export function MapPicker({ value, onChange, height = 260 }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any>(null);
  const mapInstRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const tokenRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isMapsConfigured()) {
      setErr("Map is not configured. Add the Google Maps connector to enable it.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled || !mapRef.current) return;
        const center = value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: value ? 15 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstRef.current = map;
        const marker = new google.maps.Marker({ map, position: center, draggable: true });
        markerRef.current = marker;
        try {
          placesRef.current = await google.maps.importLibrary("places");
          tokenRef.current = new placesRef.current.AutocompleteSessionToken();
        } catch (error) {
          console.warn("Google Places failed to load", error);
          placesRef.current = null;
        }

        function commit(latLng: any) {
          const lat = latLng.lat();
          const lng = latLng.lng();
          onChange({ lat, lng, address: "" });
        }

        map.addListener("click", (e: any) => {
          marker.setPosition(e.latLng);
          commit(e.latLng);
        });
        marker.addListener("dragend", (e: any) => commit(e.latLng));
        setLoading(false);
      })
      .catch((e) => {
        setErr(e?.message ?? "Map failed to load");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!markerRef.current || !mapInstRef.current || !value) return;
    const pos = { lat: value.lat, lng: value.lng };
    markerRef.current.setPosition(pos);
    mapInstRef.current.setCenter(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  async function searchPlaces(text = query) {
    const input = text.trim();
    const places = placesRef.current;
    if (!places || input.length < 2) {
      setSuggestions([]);
      return [];
    }
    setSearching(true);
    try {
      const res = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: tokenRef.current,
        includedRegionCodes: ["ss"],
      });
      const next = res?.suggestions ?? [];
      setSuggestions(next);
      return next;
    } catch {
      setSuggestions([]);
      return [];
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      searchPlaces(query);
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function selectSuggestion(suggestion: any) {
    const prediction = suggestion?.placePrediction;
    if (!prediction) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location"] });
      const loc = place.location;
      if (!loc) return;
      const lat = loc.lat();
      const lng = loc.lng();
      const address =
        place.formattedAddress || place.displayName || prediction.text?.toString?.() || query;
      mapInstRef.current?.setCenter({ lat, lng });
      mapInstRef.current?.setZoom(16);
      markerRef.current?.setPosition({ lat, lng });
      setQuery(address);
      setSuggestions([]);
      tokenRef.current = placesRef.current
        ? new placesRef.current.AutocompleteSessionToken()
        : null;
      onChange({ lat, lng, address, placeId: place.id || prediction.placeId });
    } catch (error) {
      console.warn("Could not select map place", error);
    }
  }

  async function findFirstPlace() {
    const next = suggestions.length ? suggestions : await searchPlaces(query);
    if (next[0]) await selectSuggestion(next[0]);
  }

  if (err) {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">{err}</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              findFirstPlace();
            }
          }}
          placeholder="Search a place or address…"
          className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[color:var(--ss-green)]"
        />
        <button
          type="button"
          onClick={findFirstPlace}
          className="rounded-md bg-[color:var(--ss-green)] px-3 text-xs font-semibold text-white hover:opacity-90"
        >
          {searching ? "…" : "Find"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="overflow-hidden rounded-md border bg-card text-xs shadow-sm">
          {suggestions.slice(0, 5).map((s, i) => {
            const label = s.placePrediction?.text?.toString?.() ?? "Location";
            return (
              <button
                key={`${s.placePrediction?.placeId ?? label}-${i}`}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="flex w-full items-start gap-2 border-b px-2.5 py-2 text-left last:border-0 hover:bg-muted/60"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ss-green)]" />
                <span className="line-clamp-2">{label}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="relative overflow-hidden rounded-md border bg-muted" style={{ height }}>
        <div ref={mapRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading map…
            </span>
          </div>
        )}
      </div>
      {value && (
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">
            {value.address || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`} — tap or drag the
            pin to adjust.
          </span>
        </p>
      )}
    </div>
  );
}
