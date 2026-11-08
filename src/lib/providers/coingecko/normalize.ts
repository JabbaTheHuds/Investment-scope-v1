import type { Candle, ChartData, CoinDetail, Currency, ExchangeTicker, GlobalStats, MarketRow, SearchResult, VolumePoint } from "@/lib/market/types";
import { deriveExcluding } from "@/lib/market/derive";
import type { CgCoin, CgGlobal, CgMarketItem } from "./schemas";

const n = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s = (v: string | null | undefined): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const pick = (m: Record<string, number | null> | null | undefined, c: string) => n(m?.[c]);
const pickStr = (m: Record<string, string | null> | null | undefined, c: string) => s(m?.[c]);

/** Max points kept for 7d sparklines (~168 hourly points upstream) — keeps list payloads small on mobile. */
export const SPARKLINE_MAX_POINTS = 56;

export function cleanSparkline(arr: (number | null)[] | null | undefined, maxPoints = SPARKLINE_MAX_POINTS): number[] | null {
  if (!arr || arr.length === 0) return null;
  const pts = arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (pts.length < 2) return null;
  if (pts.length <= maxPoints) return pts;
  // Even-stride downsample that always keeps the first and last (most recent) point.
  const out: number[] = [];
  const step = (pts.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) out.push(pts[Math.round(i * step)]!);
  return out;
}

export function normalizeMarketItem(m: CgMarketItem): MarketRow {
  return {
    id: m.id,
    symbol: m.symbol.toUpperCase(),
    name: m.name,
    image: s(m.image),
    rank: n(m.market_cap_rank),
    price: n(m.current_price),
    marketCap: n(m.market_cap),
    fdv: n(m.fully_diluted_valuation),
    volume24h: n(m.total_volume),
    high24h: n(m.high_24h),
    low24h: n(m.low_24h),
    change1h: n(m.price_change_percentage_1h_in_currency),
    change24h: n(m.price_change_percentage_24h_in_currency) ?? n(m.price_change_percentage_24h),
    change7d: n(m.price_change_percentage_7d_in_currency),
    change30d: n(m.price_change_percentage_30d_in_currency),
    change1y: n(m.price_change_percentage_1y_in_currency),
    marketCapChange24h: n(m.market_cap_change_24h),
    circulatingSupply: n(m.circulating_supply),
    totalSupply: n(m.total_supply),
    maxSupply: n(m.max_supply),
    ath: n(m.ath),
    athChangePct: n(m.ath_change_percentage),
    athDate: s(m.ath_date),
    atl: n(m.atl),
    atlChangePct: n(m.atl_change_percentage),
    atlDate: s(m.atl_date),
    sparkline7d: cleanSparkline(m.sparkline_in_7d?.price),
    lastUpdated: s(m.last_updated),
  };
}

export function normalizeGlobal(g: CgGlobal, currency: Currency, stablecoinMarketCapUsd: number | null): GlobalStats {
  const d = g.data;
  const total = pick(d.total_market_cap, currency);
  const btcDom = pick(d.market_cap_percentage, "btc");
  const ethDom = pick(d.market_cap_percentage, "eth");
  // Stablecoin cap is only available in USD from the categories endpoint; convert via the
  // ratio of total caps (same snapshot) when another currency is selected.
  const totalUsd = pick(d.total_market_cap, "usd");
  let stable: number | null = null;
  if (stablecoinMarketCapUsd != null) {
    if (currency === "usd") stable = stablecoinMarketCapUsd;
    else if (total != null && totalUsd) stable = stablecoinMarketCapUsd * (total / totalUsd);
  }
  return {
    totalMarketCap: total,
    totalVolume24h: pick(d.total_volume, currency),
    marketCapChange24hPct: n(d.market_cap_change_percentage_24h_usd),
    btcDominance: btcDom,
    ethDominance: ethDom,
    ...deriveExcluding(total, btcDom, ethDom),
    stablecoinMarketCap: stable,
    activeCryptocurrencies: n(d.active_cryptocurrencies),
    markets: n(d.markets),
    updatedAt: typeof d.updated_at === "number" ? new Date(d.updated_at * 1000).toISOString() : null,
  };
}

/** Strip HTML from third-party descriptions. Output is rendered as text only. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeTicker(t: NonNullable<CgCoin["tickers"]>[number]): ExchangeTicker {
  return {
    exchange: t.market.name,
    exchangeId: t.market.identifier,
    base: t.base,
    target: t.target,
    last: n(t.last),
    volumeUsd: pick(t.converted_volume, "usd"),
    spreadPct: n(t.bid_ask_spread_percentage),
    trustScore: s(t.trust_score),
    lastTradedAt: s(t.last_traded_at),
    tradeUrl: safeHttpUrl(t.trade_url),
    isStale: !!t.is_stale,
    isAnomaly: !!t.is_anomaly,
  };
}

export function normalizeCoin(c: CgCoin, currency: Currency): CoinDetail {
  const md = c.market_data ?? undefined;
  const tickers = (c.tickers ?? [])
    .map(normalizeTicker)
    .filter((t) => !t.isAnomaly)
    .sort((a, b) => (b.volumeUsd ?? -1) - (a.volumeUsd ?? -1))
    .slice(0, 25);
  const platforms = Object.entries(c.platforms ?? {})
    .filter(([chain, addr]) => chain && addr)
    .map(([chain, addr]) => ({ chain, address: addr as string }));
  return {
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    image: s(c.image?.large) ?? s(c.image?.small),
    rank: n(c.market_cap_rank),
    price: pick(md?.current_price, currency),
    marketCap: pick(md?.market_cap, currency),
    fdv: pick(md?.fully_diluted_valuation, currency),
    volume24h: pick(md?.total_volume, currency),
    high24h: pick(md?.high_24h, currency),
    low24h: pick(md?.low_24h, currency),
    change1h: pick(md?.price_change_percentage_1h_in_currency, currency),
    change24h: pick(md?.price_change_percentage_24h_in_currency, currency),
    change7d: pick(md?.price_change_percentage_7d_in_currency, currency),
    change14d: pick(md?.price_change_percentage_14d_in_currency, currency),
    change30d: pick(md?.price_change_percentage_30d_in_currency, currency),
    change60d: pick(md?.price_change_percentage_60d_in_currency, currency),
    change200d: pick(md?.price_change_percentage_200d_in_currency, currency),
    change1y: pick(md?.price_change_percentage_1y_in_currency, currency),
    marketCapChange24h: pick(md?.market_cap_change_24h_in_currency, currency),
    circulatingSupply: n(md?.circulating_supply),
    totalSupply: n(md?.total_supply),
    maxSupply: n(md?.max_supply),
    ath: pick(md?.ath, currency),
    athChangePct: pick(md?.ath_change_percentage, currency),
    athDate: pickStr(md?.ath_date, currency),
    atl: pick(md?.atl, currency),
    atlChangePct: pick(md?.atl_change_percentage, currency),
    atlDate: pickStr(md?.atl_date, currency),
    sparkline7d: cleanSparkline(md?.sparkline_7d?.price),
    lastUpdated: s(md?.last_updated) ?? s(c.last_updated),
    description: stripHtml(c.description?.en ?? "").slice(0, 4000),
    categories: (c.categories ?? []).filter((x): x is string => !!x),
    homepage: safeHttpUrl((c.links?.homepage ?? []).find((x) => !!x)),
    explorers: (c.links?.blockchain_site ?? []).map(safeHttpUrl).filter((x): x is string => !!x).slice(0, 5),
    platforms,
    genesisDate: s(c.genesis_date),
    hashingAlgorithm: s(c.hashing_algorithm),
    tickers,
  };
}

/** Free/Demo-plan OHLC granularity, per CoinGecko docs. */
export function ohlcGranularity(days: number | "max"): string {
  if (days === "max" || days > 30) return "4 days";
  if (days > 2) return "4 hours";
  return "30 minutes";
}

/**
 * Builds chart data from OHLC + market_chart responses.
 * - Drops malformed/duplicate candles and sorts ascending.
 * - Attaches to each candle the most recent rolling-24h volume sample at or before its timestamp.
 */
export function buildChart(
  ohlc: [number, number | null, number | null, number | null, number | null][],
  volumes: [number, number | null][],
  granularity: string,
): ChartData {
  const seen = new Set<number>();
  const candles: Candle[] = [];
  for (const [ms, o, h, l, c] of ohlc) {
    if (o == null || h == null || l == null || c == null) continue;
    if (![o, h, l, c].every((x) => Number.isFinite(x) && x >= 0)) continue;
    if (h < l) continue;
    const time = Math.floor(ms / 1000);
    if (seen.has(time)) continue;
    seen.add(time);
    candles.push({ time, open: o, high: h, low: l, close: c });
  }
  candles.sort((a, b) => a.time - b.time);

  const vols = volumes
    .filter((v): v is [number, number] => v[1] != null && Number.isFinite(v[1]))
    .map(([ms, v]) => ({ time: Math.floor(ms / 1000), value: v }))
    .sort((a, b) => a.time - b.time);

  const out: VolumePoint[] = [];
  let j = 0;
  let lastVal: number | null = null;
  for (const c of candles) {
    while (j < vols.length && vols[j]!.time <= c.time) {
      lastVal = vols[j]!.value;
      j++;
    }
    if (lastVal != null) out.push({ time: c.time, value: lastVal });
  }
  return { candles, volumes: out, volumeKind: "rolling-24h", granularity, candleTimeConvention: "close" };
}

export function normalizeSearch(coins: { id: string; name: string; symbol: string; market_cap_rank?: number | null; thumb?: string | null }[]): SearchResult[] {
  return coins.slice(0, 25).map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    rank: n(c.market_cap_rank),
    thumb: s(c.thumb),
    matchedBy: "name-or-symbol" as const,
  }));
}
