"use client";
import { useNow } from "@/hooks/usePolled";
import type { ApiErrorShape } from "@/hooks/usePolled";
import { formatAgo } from "@/lib/format";
import type { DataMeta } from "@/lib/market/types";
import { cx } from "./primitives";

export type FreshnessState = "fresh" | "delayed" | "stale" | "demo" | "loading";

/** Data older than 3× its refresh interval is considered stale even if no error was reported. */
export function freshnessState(meta: DataMeta | null | undefined, error: ApiErrorShape | null, now: number): FreshnessState {
  if (!meta) return "loading";
  if (meta.mode === "demo") return "demo";
  const age = now - Date.parse(meta.fetchedAt);
  if (meta.stale || error || age > meta.refreshIntervalSec * 3 * 1000) return "stale";
  if (age > meta.refreshIntervalSec * 1.5 * 1000) return "delayed";
  return "fresh";
}

const DOT: Record<FreshnessState, string> = {
  fresh: "bg-up",
  delayed: "bg-warn",
  stale: "bg-down",
  demo: "bg-warn",
  loading: "bg-muted",
};

/**
 * Shows when data was last updated, from which source, and whether it is stale.
 * Never claims "live" unless the provider is genuinely real-time.
 */
export function Freshness({ meta, error, className, compact }: { meta: DataMeta | null | undefined; error?: ApiErrorShape | null; className?: string; compact?: boolean }) {
  const now = useNow(1000);
  const state = freshnessState(meta, error ?? null, now);
  if (!meta && error) {
    return (
      <span role="status" className={cx("inline-flex items-center gap-1.5 text-xs text-down", className)} title={error.message}>
        <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", DOT.stale)} />
        Unavailable — no data received
      </span>
    );
  }
  if (!meta) {
    return <span className={cx("inline-flex items-center gap-1.5 text-xs text-muted", className)}><span className={cx("h-1.5 w-1.5 rounded-full", DOT.loading)} />Loading…</span>;
  }
  const ago = formatAgo(meta.fetchedAt, now);
  const kind = meta.realtime ? "Real-time" : `Aggregated · refreshes ~${meta.refreshIntervalSec >= 60 ? `${Math.round(meta.refreshIntervalSec / 60)} min` : `${meta.refreshIntervalSec}s`}`;
  const label =
    state === "stale"
      ? `Stale — last updated ${ago}`
      : state === "demo"
        ? `Synthetic demo data · generated ${ago}`
        : `Updated ${ago}`;
  const title = [
    `Source: ${meta.source}`,
    `Price type: ${meta.priceKind}`,
    `Fetched by server: ${meta.fetchedAt}`,
    meta.providerUpdatedAt ? `Provider timestamp: ${meta.providerUpdatedAt}` : null,
    meta.staleReason ? `Refresh failed: ${meta.staleReason}` : null,
    error ? `Latest request failed: ${error.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs", state === "stale" ? "text-down" : "text-muted", className)} title={title} role="status" aria-live="polite">
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", DOT[state], state === "fresh" && "pulse-soft")} />
      <span>{label}</span>
      {!compact && <span className="text-muted/80">· {meta.source} · {kind}</span>}
    </span>
  );
}
