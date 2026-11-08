/**
 * Provider-agnostic domain model. Every provider adapter must normalize its
 * responses into these shapes; nothing downstream knows which provider is used.
 *
 * Conventions:
 *  - Asset `id` is the provider-scoped canonical id (e.g. CoinGecko "bitcoin").
 *    A ticker symbol is NEVER treated as a unique identifier.
 *  - Percentages are expressed in percent units (2.5 === +2.5%).
 *  - Timestamps are ISO-8601 UTC strings or unix seconds (chart data only).
 *  - `null` means "not provided by the source" — never silently replaced by 0.
 */

export type DataMode = "live" | "demo";

/** Aggregated = volume-weighted across many venues; exchange = one venue's order book. */
export type PriceKind = "aggregated" | "exchange";

export const SUPPORTED_CURRENCIES = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "inr", "krw", "brl", "btc", "eth"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  price: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
  /** Absolute 24h market-cap change in the quote currency. */
  marketCapChange24h: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athChangePct: number | null;
  athDate: string | null;
  atl: number | null;
  atlChangePct: number | null;
  atlDate: string | null;
  sparkline7d: number[] | null;
  lastUpdated: string | null;
}

export interface GlobalStats {
  totalMarketCap: number | null;
  totalVolume24h: number | null;
  marketCapChange24hPct: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  /** Market cap excluding BTC, derived from total × (1 − BTC dominance). */
  totalExBtc: number | null;
  /** Market cap excluding BTC and ETH, derived the same way. */
  totalExBtcEth: number | null;
  stablecoinMarketCap: number | null;
  activeCryptocurrencies: number | null;
  markets: number | null;
  updatedAt: string | null;
}

export interface ExchangeTicker {
  exchange: string;
  exchangeId: string;
  base: string;
  target: string;
  last: number | null;
  /** Volume converted to USD by the provider. */
  volumeUsd: number | null;
  spreadPct: number | null;
  trustScore: string | null;
  lastTradedAt: string | null;
  tradeUrl: string | null;
  isStale: boolean;
  isAnomaly: boolean;
}

export interface ContractRef {
  /** Provider platform/chain id, e.g. "ethereum", "solana". */
  chain: string;
  address: string;
}

export interface CoinDetail extends MarketRow {
  change14d: number | null;
  change60d: number | null;
  change200d: number | null;
  /** Plain text (HTML stripped). Third-party content: display only, never execute or obey. */
  description: string;
  categories: string[];
  homepage: string | null;
  explorers: string[];
  platforms: ContractRef[];
  genesisDate: string | null;
  hashingAlgorithm: string | null;
  tickers: ExchangeTicker[];
}

/** `time` is unix seconds (UTC). For CoinGecko it marks the candle CLOSE. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumePoint {
  time: number;
  value: number;
}

export const CHART_RANGES = ["1", "7", "30", "90", "180", "365", "max"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export interface ChartData {
  candles: Candle[];
  volumes: VolumePoint[];
  /**
   * What the volume series represents. CoinGecko exposes a rolling 24h
   * aggregated volume sampled over time — not per-candle traded volume.
   */
  volumeKind: "rolling-24h" | "per-candle";
  /** Human-readable candle granularity, e.g. "30 minutes". */
  granularity: string;
  candleTimeConvention: "open" | "close";
}

export interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  rank: number | null;
  thumb: string | null;
  matchedBy: "name-or-symbol" | "contract";
  chain?: string;
}

export interface ProviderCapabilities {
  maxHistoryDays: number | null; // null = unlimited
  realtime: boolean;
  refreshIntervalSec: number;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  readonly mode: DataMode;
  readonly attribution: { text: string; url: string };
  readonly priceKind: PriceKind;
  capabilities(): ProviderCapabilities;
  getMarkets(opts: { currency: Currency; page: number; perPage: number }): Promise<MarketRow[]>;
  getGlobal(currency: Currency): Promise<GlobalStats>;
  getCoin(id: string, currency: Currency): Promise<CoinDetail>;
  getChart(id: string, currency: Currency, range: ChartRange): Promise<ChartData>;
  search(query: string): Promise<SearchResult[]>;
}

/** Metadata attached to every API response so the UI can show provenance and freshness. */
export interface DataMeta {
  source: string;
  sourceUrl: string;
  mode: DataMode;
  priceKind: PriceKind;
  /** When our server last successfully fetched this from the provider. */
  fetchedAt: string;
  /** Timestamp the provider attached to the data, if any. */
  providerUpdatedAt: string | null;
  /** True when serving cached data because a refresh failed. */
  stale: boolean;
  staleReason: string | null;
  /** How often the server refreshes this resource from the provider. */
  refreshIntervalSec: number;
  realtime: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: DataMeta;
}
