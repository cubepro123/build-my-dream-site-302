export function formatPrice(price: number | string, currency: string = "SSP"): string {
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (!isFinite(n) || n <= 0) return "Contact for price";
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function waLink(phone: string, message?: string): string {
  const digits = normalizeWa(phone);
  if (!digits) return "";
  const msg = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${msg}`;
}

// Normalize phone numbers for WhatsApp/tel: strip non-digits and convert
// local South-Sudan format (leading 0) to the international 211 prefix.
// Returns "" when the input has no usable digits (avoids broken wa.me/0 links).
export function normalizeWa(phone?: string | null): string {
  if (!phone) return "";
  let d = String(phone).replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "211" + d.slice(1);
  return d;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export const CATEGORIES = [
  "Vehicles",
  "Property",
  "Electronics",
  "Phones & Tablets",
  "Fashion",
  "Home & Furniture",
  "Health & Beauty",
  "Food & Agriculture",
  "Jobs",
  "Services",
  "Animals & Pets",
  "Sports & Hobbies",
  "Babies & Kids",
  "Other",
] as const;

export const SS_LOCATIONS = [
  "Juba",
  "Wau",
  "Malakal",
  "Yei",
  "Bor",
  "Aweil",
  "Yambio",
  "Rumbek",
  "Torit",
  "Kuajok",
  "Bentiu",
  "Other",
] as const;