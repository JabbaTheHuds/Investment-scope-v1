/** Display formatting. Missing values render as an em dash, never as 0. */
import type { Currency } from "@/lib/market/types";

const DASH = "—";
const CRYPTO_QUOTES: Partial<Record<Currency, string>> = { btc: "₿", eth: "Ξ" };

export function formatPrice(v: number | null | undefined, currency: Currency, locale?: string): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return money(v, currency, { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits }, locale);
}

export function formatCompactMoney(v: number | null | undefined, currency: Currency, locale?: string): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return money(v, currency, { notation: "compact", maximumFractionDigits: 2 }, locale);
}

function money(v: number, currency: Currency, opts: Intl.NumberFormatOptions, locale?: string) {
  const sym = CRYPTO_QUOTES[currency];
  if (sym) return `${sym}${new Intl.NumberFormat(locale, opts).format(v)}`;
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), ...opts }).format(v);
}

export function formatNumber(v: number | null | undefined, opts: Intl.NumberFormatOptions = {}, locale?: string): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, ...opts }).format(v);
}

export function formatCompact(v: number | null | undefined, locale?: string): string {
  return formatNumber(v, { notation: "compact", maximumFractionDigits: 2 }, locale);
}

/** "+2.31%" / "−1.05%" — sign is always explicit so colour is never the only cue. */
export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return `${(0).toFixed(digits)}%`;
  return `${v > 0 ? "+" : "−"}${s}%`;
}

export function direction(v: number | null | undefined): "up" | "down" | "flat" | "unknown" {
  if (v == null || !Number.isFinite(v)) return "unknown";
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}

/** "8 seconds ago", "3 minutes ago". */
export function formatAgo(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso == null) return "unknown";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} days ago`;
}

export function formatDate(iso: string | null | undefined, timeZone?: string, withTime = false): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}),
    timeZone,
  }).format(d);
}
