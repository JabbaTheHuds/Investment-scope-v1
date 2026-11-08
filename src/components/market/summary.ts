import { formatCompactMoney, formatPct } from "@/lib/format";
import type { GlobalResponse } from "@/lib/market/api-types";
import type { Currency } from "@/lib/market/types";

/**
 * Deterministic, template-based summary of measured market data. No language
 * model is involved and no causes are inferred — it only restates numbers.
 */
export function buildMarketSummary(g: GlobalResponse, currency: Currency): string[] {
  const out: string[] = [];
  const d = g.data;
  if (d.totalMarketCap != null && d.marketCapChange24hPct != null) {
    const dir = d.marketCapChange24hPct > 0 ? "risen" : d.marketCapChange24hPct < 0 ? "fallen" : "been flat";
    out.push(`Total crypto market capitalization is ${formatCompactMoney(d.totalMarketCap, currency)}, having ${dir} ${formatPct(Math.abs(d.marketCapChange24hPct)).replace("+", "")} over 24 hours (USD basis).`);
  }
  const a = g.analysis;
  if (a) {
    const b = a.breadth;
    const known = b.advancers + b.decliners + b.unchanged;
    if (known > 0) {
      const advShare = (b.advancers / known) * 100;
      const tone = advShare >= 65 ? "broad gains" : advShare <= 35 ? "broad declines" : "mixed participation";
      out.push(`Among the ${a.sampleDescription.toLowerCase()}, ${b.advancers} rose and ${b.decliners} fell over 24h (${advShare.toFixed(0)}% advancing) — ${tone}. Median 24h change: ${formatPct(b.median24h)}.`);
    }
    if (b.pctOutperformingBtc != null) {
      out.push(`${b.pctOutperformingBtc.toFixed(0)}% of the sample outperformed Bitcoin over 24h.`);
    }
    const top = a.contributors.contributors.slice(0, 3).filter((c) => c.marketCapChange24h !== 0);
    if (top.length) {
      const parts = top.map((c) => `${c.name} (${c.marketCapChange24h > 0 ? "+" : "−"}${formatCompactMoney(Math.abs(c.marketCapChange24h), currency)})`);
      out.push(`Largest absolute market-cap moves: ${parts.join(", ")}.`);
    }
    // Narrow participation check: cap-weighted direction disagrees with the median asset.
    if (d.marketCapChange24hPct != null && b.median24h != null && Math.sign(d.marketCapChange24hPct) !== Math.sign(b.median24h) && Math.abs(d.marketCapChange24hPct - b.median24h) > 1) {
      out.push(`The cap-weighted market and the median asset moved in opposite directions, which indicates the headline move is driven by a small number of large assets rather than broad participation.`);
    }
  }
  return out;
}
