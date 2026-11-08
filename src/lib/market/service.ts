import { marketCache, type CacheOptions, type SwrCache } from "@/lib/cache/swr-cache";
import type { ChartData, ChartRange, CoinDetail, Currency, DataMeta, Envelope, GlobalStats, MarketDataProvider, MarketRow, SearchResult } from "./types";

const MIN = 60_000;
/** TTLs tuned to CoinGecko's ~60s cache on public endpoints and free-plan rate limits. */
export const TTL = {
  markets: { ttlMs: 60_000, maxStaleMs: 30 * MIN },
  global: { ttlMs: 60_000, maxStaleMs: 30 * MIN },
  coin: { ttlMs: 60_000, maxStaleMs: 30 * MIN },
  chart: { ttlMs: 5 * MIN, maxStaleMs: 6 * 60 * MIN },
  search: { ttlMs: 10 * MIN, maxStaleMs: 24 * 60 * MIN },
} satisfies Record<string, CacheOptions>;

export class MarketService {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly cache: SwrCache = marketCache,
  ) {}

  private meta(fetchedAt: number, stale: boolean, staleReason: string | null, providerUpdatedAt: string | null, refreshSec: number): DataMeta {
    const caps = this.provider.capabilities();
    return {
      source: this.provider.label,
      sourceUrl: this.provider.attribution.url,
      mode: this.provider.mode,
      priceKind: this.provider.priceKind,
      fetchedAt: new Date(fetchedAt).toISOString(),
      providerUpdatedAt,
      stale,
      staleReason,
      refreshIntervalSec: refreshSec,
      realtime: caps.realtime,
    };
  }

  private key(...parts: (string | number)[]) {
    return [this.provider.id, ...parts].join(":");
  }

  async markets(currency: Currency, page: number, perPage: number): Promise<Envelope<MarketRow[]>> {
    const r = await this.cache.get(this.key("markets", currency, page, perPage), TTL.markets, () => this.provider.getMarkets({ currency, page, perPage }));
    const newest = r.value.reduce<string | null>((m, x) => (x.lastUpdated && (!m || x.lastUpdated > m) ? x.lastUpdated : m), null);
    return { data: r.value, meta: this.meta(r.fetchedAt, r.stale, r.staleReason, newest, TTL.markets.ttlMs / 1000) };
  }

  async global(currency: Currency): Promise<Envelope<GlobalStats>> {
    const r = await this.cache.get(this.key("global", currency), TTL.global, () => this.provider.getGlobal(currency));
    return { data: r.value, meta: this.meta(r.fetchedAt, r.stale, r.staleReason, r.value.updatedAt, TTL.global.ttlMs / 1000) };
  }

  async coin(id: string, currency: Currency): Promise<Envelope<CoinDetail>> {
    const r = await this.cache.get(this.key("coin", id, currency), TTL.coin, () => this.provider.getCoin(id, currency));
    return { data: r.value, meta: this.meta(r.fetchedAt, r.stale, r.staleReason, r.value.lastUpdated, TTL.coin.ttlMs / 1000) };
  }

  async chart(id: string, currency: Currency, range: ChartRange): Promise<Envelope<ChartData & { maxHistoryDays: number | null }>> {
    const r = await this.cache.get(this.key("chart", id, currency, range), TTL.chart, () => this.provider.getChart(id, currency, range));
    const last = r.value.candles.at(-1);
    return {
      data: { ...r.value, maxHistoryDays: this.provider.capabilities().maxHistoryDays },
      meta: this.meta(r.fetchedAt, r.stale, r.staleReason, last ? new Date(last.time * 1000).toISOString() : null, TTL.chart.ttlMs / 1000),
    };
  }

  async search(query: string): Promise<Envelope<SearchResult[]>> {
    const q = query.trim();
    // Base58 contract addresses (e.g. Solana) are case-sensitive; everything else is not.
    const k = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) ? q : q.toLowerCase();
    const r = await this.cache.get(this.key("search", k), TTL.search, () => this.provider.search(q));
    return { data: r.value, meta: this.meta(r.fetchedAt, r.stale, r.staleReason, null, TTL.search.ttlMs / 1000) };
  }
}
