"use client";
import { Card, CardHeader, cx } from "@/components/ui/primitives";
import { usePrefs } from "@/components/shell/PreferencesProvider";
import { bollinger, rsi, sma } from "@/lib/indicators";
import { formatNumber, formatPct, formatPrice } from "@/lib/format";
import type { ChartResponse } from "@/lib/market/api-types";

/**
 * Descriptive indicator readings computed from the same candles shown in the chart.
 * Every reading states its basis; none is presented as a prediction.
 */
export function IndicatorSnapshot({ chart }: { chart: ChartResponse | null }) {
  const { currency } = usePrefs();
  if (!chart || chart.data.candles.length === 0) return null;
  const candles = chart.data.candles;
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1]!;
  const r = rsi(closes, 14).at(-1) ?? null;
  const s20 = sma(closes, 20).at(-1) ?? null;
  const s50 = sma(closes, 50).at(-1) ?? null;
  const bb = bollinger(closes, 20, 2);
  const up = bb.upper.at(-1) ?? null, lo = bb.lower.at(-1) ?? null;
  const pctB = up != null && lo != null && up !== lo ? ((last - lo) / (up - lo)) * 100 : null;
  const basis = `${candles.length} × ${chart.data.granularity} candles`;

  const rows: { name: string; value: string; reading: string; tone?: "up" | "down" }[] = [];
  if (r != null) {
    rows.push({
      name: "RSI (14)",
      value: formatNumber(r, { maximumFractionDigits: 1 }),
      reading:
        r >= 70 ? "Elevated: recent gains have dominated losses. Elevated RSI alone does not establish that a reversal is imminent — it can stay high in strong trends."
        : r <= 30 ? "Depressed: recent losses have dominated gains. Low RSI alone does not establish that a rebound is imminent."
        : "Mid-range: neither gains nor losses have strongly dominated recent candles.",
      tone: r >= 70 ? "up" : r <= 30 ? "down" : undefined,
    });
  }
  for (const [label, v] of [["SMA 20", s20], ["SMA 50", s50]] as const) {
    if (v == null) continue;
    const diff = ((last - v) / v) * 100;
    rows.push({ name: label, value: formatPrice(v, currency), reading: `Last close is ${formatPct(diff)} ${diff >= 0 ? "above" : "below"} its ${label.toLowerCase()} — describes the recent trend relative to the average, not its future direction.`, tone: diff >= 0 ? "up" : "down" });
  }
  if (pctB != null) {
    rows.push({ name: "Bollinger %B", value: `${pctB.toFixed(0)}%`, reading: pctB > 100 ? "Close is above the upper band: unusually high relative to recent volatility." : pctB < 0 ? "Close is below the lower band: unusually low relative to recent volatility." : "Close is inside the bands (0% = lower band, 100% = upper band)." });
  }

  return (
    <Card>
      <CardHeader title="Indicator snapshot" subtitle={`Computed from ${basis} shown in the chart. Descriptive only — no single indicator predicts price.`} />
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted">Not enough candles in this range to compute indicators. Choose a longer range.</p>
      ) : (
        <dl className="divide-y divide-line/60">
          {rows.map((x) => (
            <div key={x.name} className="grid grid-cols-[7rem_6rem_1fr] items-baseline gap-3 px-4 py-2.5 text-sm max-sm:grid-cols-[6rem_1fr]">
              <dt className="font-medium">{x.name}</dt>
              <dd className={cx("tabular", x.tone === "up" && "text-up", x.tone === "down" && "text-down")}>{x.value}</dd>
              <dd className="text-xs leading-relaxed text-muted max-sm:col-span-2">{x.reading}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
