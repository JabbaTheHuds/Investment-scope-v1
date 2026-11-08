"use client";
import { direction, formatPct } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children, as: As = "section", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <As className={cx("min-w-0 rounded-xl border border-line bg-panel shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, subtitle, right, id }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Percentage change with arrow glyph and explicit sign — colour is never the only signal. */
export function Change({ value, className, digits = 2 }: { value: number | null | undefined; className?: string; digits?: number }) {
  const d = direction(value);
  const glyph = d === "up" ? "▲" : d === "down" ? "▼" : "";
  const label = d === "up" ? "up" : d === "down" ? "down" : d === "flat" ? "unchanged" : "not available";
  return (
    <span
      className={cx("tabular inline-flex items-center gap-1 whitespace-nowrap", d === "up" && "text-up", d === "down" && "text-down", (d === "flat" || d === "unknown") && "text-muted", className)}
      aria-label={value == null ? "change not available" : `${label} ${formatPct(value, digits)}`}
    >
      {glyph && <span aria-hidden className="text-[0.7em]">{glyph}</span>}
      {formatPct(value, digits)}
    </span>
  );
}

export function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" | "up" | "down"; title?: string }) {
  const tones = {
    neutral: "border-line text-muted",
    accent: "border-accent/40 text-accent bg-accent/10",
    warn: "border-warn/40 text-warn bg-warn/10",
    up: "border-up/40 text-up bg-up/10",
    down: "border-down/40 text-down bg-down/10",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", tones[tone])}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block animate-pulse rounded bg-panel-2", className)} />;
}

export function ErrorState({ title = "Data unavailable", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-down/30 bg-down/5 p-4 text-sm">
      <p className="font-medium text-down">{title}</p>
      <p className="text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border border-line px-3 py-1 text-xs hover:bg-panel-2">
          Retry
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, hint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted" title={hint}>
        {label}
        {hint && <span aria-hidden className="cursor-help text-muted/70">ⓘ</span>}
      </dt>
      <dd className="tabular mt-1 truncate text-lg font-semibold">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs">{sub}</dd>}
    </div>
  );
}

export function Sparkline({ data, width = 120, height = 32, label }: { data: number[] | null; width?: number; height?: number; label?: string }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 2) - 1).toFixed(1)}`).join("");
  const up = data[data.length - 1]! >= data[0]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? `7-day trend ${up ? "up" : "down"}`}>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

export function AssetIcon({ src, symbol, size = 24 }: { src: string | null; symbol: string; size?: number }) {
  if (!src) {
    return (
      <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-panel-2 text-[9px] font-bold text-muted">
        {symbol.slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full" />;
}
