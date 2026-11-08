/**
 * DEMONSTRATION provider — produces SYNTHETIC data for fictional assets.
 *
 * It exists only so the UI can be exercised without network access or API keys.
 * Asset names are deliberately fictional (suffix "Demo") so synthetic numbers can
 * never be mistaken for real market prices, and every response is tagged mode="demo".
 */
import { NotFoundError } from "@/lib/market/errors";
import { deriveExcluding } from "@/lib/market/derive";
import type { Candle, ChartData, ChartRange, CoinDetail, Currency, GlobalStats, MarketDataProvider, MarketRow, ProviderCapabilities, SearchResult } from "@/lib/market/types";

const NAMES = [
  "Aurora", "Basalt", "Cinder", "Drift", "Ember", "Fjord", "Glacier", "Harbor", "Ion", "Juniper",
  "Kestrel", "Lumen", "Meridian", "Nimbus", "Obsidian", "Prism", "Quartz", "Ridge", "Summit", "Tundra",
  "Umber", "Vertex", "Willow", "Xenon", "Yarrow", "Zephyr", "Atlas", "Beacon", "Cobalt", "Delta",
  "Echo", "Flint", "Garnet", "Helix", "Indigo", "Jasper", "Kelvin", "Lattice", "Mosaic", "Nova",
  "Onyx", "Pulse", "Quill", "Raven", "Sable", "Tempest", "Unity", "Vale", "Wren", "Yonder",
];

const HOUR = 3600;
const DAY = 86400;
const SPAN_SECONDS: Record<Exclude<ChartRange, "max">, number> = { "1": DAY, "7": 7 * DAY, "30": 30 * DAY, "90": 90 * DAY, "180": 180 * DAY, "365": 365 * DAY };
const FX: Record<Currency, number> = { usd: 1, eur: 0.92, gbp: 0.79, jpy: 150, cad: 1.36, aud: 1.52, chf: 0.88, inr: 83, krw: 1350, brl: 5.0, btc: 1 / 50_000, eth: 1 / 2_500 };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface DemoAsset {
  id: string;
  name: string;
  symbol: string;
  basePrice: number;
  supply: number;
  maxSupply: number | null;
  vol: number; // daily volatility
}

const ASSETS: DemoAsset[] = NAMES.map((n, i) => {
  const r = mulberry32(hash(n));
  const basePrice = i === 0 ? 40_000 : i === 1 ? 2_000 : Math.exp(r() * 9 - 4);
  const cap = 6e11 / Math.pow(i + 1, 1.6);
  return {
    id: `demo-${n.toLowerCase()}`,
    name: `${n} Demo`,
    symbol: `${n.slice(0, 3).toUpperCase()}D`,
    basePrice,
    supply: cap / basePrice,
    maxSupply: r() > 0.5 ? (cap / basePrice) * (1 + r()) : null,
    vol: 0.015 + r() * 0.06,
  };
});

const ANCHOR_HOUR = Math.floor(1_700_000_000 / HOUR);
const walks = new Map<string, number[]>();

/** Hourly log-price random walk, memoised and extended lazily (deterministic per asset). */
function logPriceAtHour(a: DemoAsset, hourIdx: number): number {
  const steps = Math.max(0, hourIdx - ANCHOR_HOUR);
  let w = walks.get(a.id);
  if (!w) {
    w = [Math.log(a.basePrice)];
    walks.set(a.id, w);
  }
  if (w.length <= steps) {
    const seed = hash(a.id);
    const hourlyVol = a.vol / Math.sqrt(24);
    const base = Math.log(a.basePrice);
    for (let i = w.length; i <= steps; i++) {
      const rnd = mulberry32(seed ^ Math.imul(i, 2654435761));
      let lp = w[i - 1]! + (rnd() + rnd() + rnd() - 1.5) * hourlyVol * 2;
      lp += (base - lp) * 0.002; // gentle mean reversion keeps synthetic prices bounded
      w.push(lp);
    }
  }
  return w[steps]!;
}

/** Deterministic price for an asset at a given unix-second time (linear interpolation between hours). */
function priceAt(a: DemoAsset, t: number): number {
  const h = Math.floor(t / HOUR);
  const frac = (t - h * HOUR) / HOUR;
  const lp0 = logPriceAtHour(a, h);
  const lp1 = logPriceAtHour(a, h + 1);
  return Math.exp(lp0 + (lp1 - lp0) * frac);
}

function changePct(a: DemoAsset, now: number, seconds: number) {
  const p0 = priceAt(a, now - seconds);
  return ((priceAt(a, now) - p0) / p0) * 100;
}

function row(a: DemoAsset, rank: number, currency: Currency, now: number): MarketRow {
  const fx = FX[currency];
  const p = priceAt(a, now) * fx;
  const spark: number[] = [];
  for (let t = now - 7 * DAY; t <= now; t += HOUR) spark.push(priceAt(a, t) * fx);
  let hi = -Infinity, lo = Infinity;
  for (let t = now - DAY; t <= now; t += HOUR / 4) {
    const v = priceAt(a, t) * fx;
    hi = Math.max(hi, v);
    lo = Math.min(lo, v);
  }
  const ath = Math.max(...spark) * 1.8;
  const atl = Math.min(...spark) * 0.2;
  const cap = p * a.supply;
  const capPrev = priceAt(a, now - DAY) * fx * a.supply;
  return {
    id: a.id, symbol: a.symbol, name: a.name, image: null, rank,
    price: p, marketCap: cap, fdv: a.maxSupply ? p * a.maxSupply : null,
    volume24h: cap * (0.02 + (hash(a.id) % 100) / 1000),
    high24h: hi, low24h: lo,
    change1h: changePct(a, now, HOUR), change24h: changePct(a, now, DAY), change7d: changePct(a, now, 7 * DAY),
    change30d: changePct(a, now, 30 * DAY), change1y: changePct(a, now, 365 * DAY),
    marketCapChange24h: cap - capPrev,
    circulatingSupply: a.supply, totalSupply: a.maxSupply ?? a.supply, maxSupply: a.maxSupply,
    ath, athChangePct: ((p - ath) / ath) * 100, athDate: new Date((now - 200 * DAY) * 1000).toISOString(),
    atl, atlChangePct: ((p - atl) / atl) * 100, atlDate: new Date((now - 900 * DAY) * 1000).toISOString(),
    sparkline7d: spark, lastUpdated: new Date(now * 1000).toISOString(),
  };
}

export class DemoProvider implements MarketDataProvider {
  readonly id = "demo";
  readonly label = "Demo (synthetic)";
  readonly mode = "demo" as const;
  readonly priceKind = "aggregated" as const;
  readonly attribution = { text: "SYNTHETIC demonstration data — not real market values", url: "/status" };

  constructor(private readonly clock: () => number = () => Math.floor(Date.now() / 1000)) {}

  capabilities(): ProviderCapabilities {
    return { maxHistoryDays: 365, realtime: false, refreshIntervalSec: 30 };
  }

  private ranked(currency: Currency) {
    const now = this.clock();
    return ASSETS.map((a) => row(a, 0, currency, now))
      .sort((x, y) => (y.marketCap ?? 0) - (x.marketCap ?? 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

  async getMarkets({ currency, page, perPage }: { currency: Currency; page: number; perPage: number }) {
    return this.ranked(currency).slice((page - 1) * perPage, page * perPage);
  }

  async getGlobal(currency: Currency): Promise<GlobalStats> {
    const rows = this.ranked(currency);
    const total = rows.reduce((s, r) => s + (r.marketCap ?? 0), 0);
    const prevTotal = rows.reduce((s, r) => s + (r.marketCap ?? 0) - (r.marketCapChange24h ?? 0), 0);
    const first = rows[0]?.marketCap ?? 0;
    const second = rows[1]?.marketCap ?? 0;
    const btcDom = (first / total) * 100;
    const ethDom = (second / total) * 100;
    return {
      totalMarketCap: total,
      totalVolume24h: rows.reduce((s, r) => s + (r.volume24h ?? 0), 0),
      marketCapChange24hPct: ((total - prevTotal) / prevTotal) * 100,
      btcDominance: btcDom,
      ethDominance: ethDom,
      ...deriveExcluding(total, btcDom, ethDom),
      stablecoinMarketCap: total * 0.07,
      activeCryptocurrencies: ASSETS.length,
      markets: ASSETS.length * 12,
      updatedAt: new Date(this.clock() * 1000).toISOString(),
    };
  }

  async getCoin(id: string, currency: Currency): Promise<CoinDetail> {
    const r = this.ranked(currency).find((x) => x.id === id);
    if (!r) throw new NotFoundError(this.label, id);
    const a = ASSETS.find((x) => x.id === id)!;
    const now = this.clock();
    return {
      ...r,
      change14d: changePct(a, now, 14 * DAY),
      change60d: changePct(a, now, 60 * DAY),
      change200d: changePct(a, now, 200 * DAY),
      description: `${a.name} is a FICTIONAL asset generated for CryptoScope AI's demonstration mode. All figures on this page are synthetic and must not be used for any decision.`,
      categories: ["Demonstration"],
      homepage: null,
      explorers: [],
      platforms: [],
      genesisDate: null,
      hashingAlgorithm: null,
      tickers: [],
    };
  }

  async getChart(id: string, currency: Currency, range: ChartRange): Promise<ChartData> {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new NotFoundError(this.label, id);
    const fx = FX[currency];
    const span = range === "max" ? 365 * DAY : SPAN_SECONDS[range];
    const step = range === "1" ? 30 * 60 : Number(range === "max" ? 365 : range) <= 30 ? 4 * HOUR : 4 * DAY;
    const now = this.clock();
    const end = now - (now % step);
    const candles: Candle[] = [];
    for (let t = end - span + step; t <= end; t += step) {
      const sub = 6;
      const pts: number[] = [];
      for (let k = 0; k <= sub; k++) pts.push(priceAt(a, t - step + (k * step) / sub) * fx);
      candles.push({ time: t, open: pts[0]!, high: Math.max(...pts), low: Math.min(...pts), close: pts[sub]! });
    }
    const volumes = candles.map((c) => ({ time: c.time, value: c.close * a.supply * 0.04 * (0.7 + (hash(a.id + c.time) % 60) / 100) }));
    return { candles, volumes, volumeKind: "rolling-24h", granularity: step === 1800 ? "30 minutes" : step === 4 * HOUR ? "4 hours" : "4 days", candleTimeConvention: "close" };
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.ranked("usd")
      .filter((r) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q) || r.id.includes(q))
      .slice(0, 20)
      .map((r) => ({ id: r.id, name: r.name, symbol: r.symbol, rank: r.rank, thumb: null, matchedBy: "name-or-symbol" as const }));
  }
}
