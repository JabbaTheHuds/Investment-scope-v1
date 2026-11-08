import type { z } from "zod";
import { NotFoundError, ProviderError, RateLimitedError, ValidationError } from "@/lib/market/errors";
import { recordFailure, recordSuccess } from "@/lib/market/status";
import type { ChartData, ChartRange, CoinDetail, Currency, GlobalStats, MarketDataProvider, MarketRow, ProviderCapabilities, SearchResult } from "@/lib/market/types";
import { TokenBucket } from "@/lib/cache/token-bucket";
import { CgCategories, CgCoin, CgGlobal, CgMarketChart, CgMarkets, CgOhlc, CgSearch } from "./schemas";
import { buildChart, normalizeCoin, normalizeGlobal, normalizeMarketItem, normalizeSearch, ohlcGranularity } from "./normalize";

export type CoinGeckoPlan = "public" | "demo" | "pro";

export interface CoinGeckoOptions {
  plan: CoinGeckoPlan;
  apiKey?: string;
  ratePerMin: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const ID = "coingecko";
const LABEL = "CoinGecko";
const EVM_CONTRACT = /^0x[a-fA-F0-9]{40}$/;
const BASE58_CONTRACT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Platforms probed for contract-address search (CoinGecko asset_platform ids). */
const EVM_PLATFORMS = ["ethereum", "binance-smart-chain", "base", "arbitrum-one", "polygon-pos"];

export class CoinGeckoProvider implements MarketDataProvider {
  readonly id = ID;
  readonly label = LABEL;
  readonly mode = "live" as const;
  readonly priceKind = "aggregated" as const;
  readonly attribution = { text: "Data provided by CoinGecko", url: "https://www.coingecko.com/en/api" };

  private readonly base: string;
  private readonly headers: Record<string, string>;
  private readonly bucket: TokenBucket;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: CoinGeckoOptions) {
    this.base = opts.plan === "pro" ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
    this.headers = { accept: "application/json" };
    if (opts.apiKey && opts.plan === "pro") this.headers["x-cg-pro-api-key"] = opts.apiKey;
    if (opts.apiKey && opts.plan === "demo") this.headers["x-cg-demo-api-key"] = opts.apiKey;
    this.bucket = new TokenBucket(Math.max(1, Math.min(10, opts.ratePerMin)), opts.ratePerMin / 60);
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  capabilities(): ProviderCapabilities {
    // Public & Demo plans are limited to the past 365 days of historical data.
    return { maxHistoryDays: this.opts.plan === "pro" ? null : 365, realtime: false, refreshIntervalSec: 60 };
  }

  private async request<S extends z.ZodTypeAny>(path: string, params: Record<string, string>, schema: S): Promise<z.infer<S>> {
    if (!this.bucket.tryAcquire()) {
      const err = new RateLimitedError(LABEL, Math.ceil(this.bucket.waitMs() / 1000));
      recordFailure(ID, LABEL, err);
      throw err;
    }
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers: this.headers, signal: AbortSignal.timeout(this.timeoutMs), cache: "no-store" });
    } catch (e) {
      const err = new ProviderError(`${LABEL} request failed: ${e instanceof Error ? e.message : String(e)}`, LABEL);
      recordFailure(ID, LABEL, err);
      throw err;
    }

    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after")) || 60;
      this.bucket.blockFor(retry);
      const err = new RateLimitedError(LABEL, retry);
      recordFailure(ID, LABEL, err);
      throw err;
    }
    if (res.status === 404) {
      // A 404 means the asset doesn't exist — the provider itself is healthy.
      recordSuccess(ID, LABEL);
      throw new NotFoundError(LABEL, path);
    }
    if (!res.ok) {
      const err = new ProviderError(`${LABEL} responded ${res.status}`, LABEL, res.status);
      recordFailure(ID, LABEL, err);
      throw err;
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      const err = new ValidationError(LABEL, "body is not JSON");
      recordFailure(ID, LABEL, err);
      throw err;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const err = new ValidationError(LABEL, `${path}: ${first?.path.join(".")} ${first?.message}`);
      recordFailure(ID, LABEL, err);
      throw err;
    }
    recordSuccess(ID, LABEL);
    return parsed.data;
  }

  async getMarkets({ currency, page, perPage }: { currency: Currency; page: number; perPage: number }): Promise<MarketRow[]> {
    const data = await this.request(
      "/coins/markets",
      {
        vs_currency: currency,
        order: "market_cap_desc",
        per_page: String(perPage),
        page: String(page),
        sparkline: "true",
        price_change_percentage: "1h,24h,7d,30d,1y",
      },
      CgMarkets,
    );
    // De-duplicate by id defensively (CoinGecko pagination can shift between pages).
    const seen = new Set<string>();
    return data.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).map(normalizeMarketItem);
  }

  async getGlobal(currency: Currency): Promise<GlobalStats> {
    const [global, categories] = await Promise.all([
      this.request("/global", {}, CgGlobal),
      // Stablecoin cap is optional: failure here should not break global stats.
      this.request("/coins/categories", {}, CgCategories).catch(() => null),
    ]);
    const stable = categories?.find((c) => c.id === "stablecoins")?.market_cap ?? null;
    return normalizeGlobal(global, currency, stable);
  }

  async getCoin(id: string, currency: Currency): Promise<CoinDetail> {
    const data = await this.request(
      `/coins/${encodeURIComponent(id)}`,
      { localization: "false", tickers: "true", market_data: "true", community_data: "false", developer_data: "false", sparkline: "true" },
      CgCoin,
    );
    return normalizeCoin(data, currency);
  }

  async getChart(id: string, currency: Currency, range: ChartRange): Promise<ChartData> {
    const caps = this.capabilities();
    let days: ChartRange = range;
    if (range === "max" && caps.maxHistoryDays != null) days = "365";
    // CoinGecko OHLC accepts 1/7/14/30/90/180/365/max.
    const [ohlc, mc] = await Promise.all([
      this.request(`/coins/${encodeURIComponent(id)}/ohlc`, { vs_currency: currency, days }, CgOhlc),
      this.request(`/coins/${encodeURIComponent(id)}/market_chart`, { vs_currency: currency, days }, CgMarketChart),
    ]);
    return buildChart(ohlc, mc.total_volumes, ohlcGranularity(days === "max" ? "max" : Number(days)));
  }

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (EVM_CONTRACT.test(q) || BASE58_CONTRACT.test(q)) {
      const platforms = EVM_CONTRACT.test(q) ? EVM_PLATFORMS : ["solana"];
      const results = await Promise.allSettled(
        platforms.map((p) =>
          this.request(`/coins/${p}/contract/${encodeURIComponent(EVM_CONTRACT.test(q) ? q.toLowerCase() : q)}`, {}, CgCoin).then((c) => ({ c, p })),
        ),
      );
      const found: SearchResult[] = [];
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { c, p } = r.value;
        if (found.some((f) => f.id === c.id)) continue;
        found.push({ id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank ?? null, thumb: c.image?.thumb ?? null, matchedBy: "contract", chain: p });
      }
      if (found.length) return found;
      if (results.every((r) => r.status === "rejected" && !(r.reason instanceof NotFoundError))) {
        throw (results[0] as PromiseRejectedResult).reason;
      }
      return [];
    }
    const data = await this.request("/search", { query: q }, CgSearch);
    return normalizeSearch(data.coins);
  }
}
