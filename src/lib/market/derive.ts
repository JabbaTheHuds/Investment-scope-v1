import type { MarketRow } from "./types";

/** total × (1 − dominance%) — derived values, labelled as such in the UI. */
export function deriveExcluding(total: number | null, btcDom: number | null, ethDom: number | null) {
  const totalExBtc = total != null && btcDom != null ? total * (1 - btcDom / 100) : null;
  const totalExBtcEth = total != null && btcDom != null && ethDom != null ? total * (1 - (btcDom + ethDom) / 100) : null;
  return { totalExBtc, totalExBtcEth };
}

export interface Breadth {
  sample: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  /** Assets with no 24h change reported. */
  unknown: number;
  /** Median 24h % change across the sample. */
  median24h: number | null;
  /** Share of sample outperforming BTC over 24h, when BTC is in the sample. */
  pctOutperformingBtc: number | null;
}

/** Breadth over a market sample (e.g. top 250 by market cap). Threshold avoids counting noise as moves. */
export function computeBreadth(rows: MarketRow[], flatThresholdPct = 0.05): Breadth {
  let adv = 0, dec = 0, flat = 0, unknown = 0;
  const changes: number[] = [];
  for (const r of rows) {
    if (r.change24h == null) { unknown++; continue; }
    changes.push(r.change24h);
    if (r.change24h > flatThresholdPct) adv++;
    else if (r.change24h < -flatThresholdPct) dec++;
    else flat++;
  }
  changes.sort((a, b) => a - b);
  const median = changes.length === 0 ? null : changes.length % 2 ? changes[(changes.length - 1) / 2]! : (changes[changes.length / 2 - 1]! + changes[changes.length / 2]!) / 2;
  const btc = rows.find((r) => r.id === "bitcoin");
  let pctOut: number | null = null;
  if (btc?.change24h != null && changes.length > 1) {
    const others = rows.filter((r) => r.id !== "bitcoin" && r.change24h != null);
    pctOut = others.length ? (others.filter((r) => r.change24h! > btc.change24h!).length / others.length) * 100 : null;
  }
  return { sample: rows.length, advancers: adv, decliners: dec, unchanged: flat, unknown, median24h: median, pctOutperformingBtc: pctOut };
}

export interface Contributor {
  id: string;
  symbol: string;
  name: string;
  marketCapChange24h: number;
  /** Share of the sample's net 24h market-cap change, in percent. */
  shareOfNetPct: number | null;
}

/** Assets contributing most (in absolute market-cap terms) to the sample's 24h move. */
export function topContributors(rows: MarketRow[], limit = 5): { net: number; contributors: Contributor[] } {
  const valid = rows.filter((r) => r.marketCapChange24h != null);
  const net = valid.reduce((a, r) => a + r.marketCapChange24h!, 0);
  const contributors = valid
    .sort((a, b) => Math.abs(b.marketCapChange24h!) - Math.abs(a.marketCapChange24h!))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      marketCapChange24h: r.marketCapChange24h!,
      shareOfNetPct: net !== 0 ? (r.marketCapChange24h! / net) * 100 : null,
    }));
  return { net, contributors };
}
