import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoriesFixture, coinFixture, globalFixture, marketsFixture } from "../../../../tests/fixtures/coingecko";
import { NotFoundError, ProviderError, RateLimitedError, ValidationError } from "@/lib/market/errors";
import { CgCoin, CgGlobal, CgMarkets } from "./schemas";
import { buildChart, normalizeCoin, normalizeGlobal, normalizeMarketItem, stripHtml } from "./normalize";
import { CoinGeckoProvider } from "./provider";

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("CoinGecko normalization", () => {
  it("normalizes market rows and preserves nulls instead of inventing zeros", () => {
    const rows = CgMarkets.parse(marketsFixture).map(normalizeMarketItem);
    expect(rows[0]).toMatchObject({ id: "bitcoin", symbol: "BTC", price: 70000, change1h: 0.12, change24h: 1.45, change30d: -2.1, marketCapChange24h: 19e9 });
    expect(rows[0]!.sparkline7d).toEqual([68000, 68500, 69000, 70000]); // null dropped
    const odd = rows[1]!;
    expect(odd.marketCap).toBeNull();
    expect(odd.change24h).toBeNull();
    expect(odd.rank).toBeNull();
    expect(odd.sparkline7d).toBeNull();
  });

  it("keeps assets that share a ticker distinct by id", () => {
    const rows = CgMarkets.parse(marketsFixture).map(normalizeMarketItem);
    expect(rows.filter((r) => r.symbol === "BTC").map((r) => r.id)).toEqual(["bitcoin", "obscure-token"]);
  });

  it("derives ex-BTC totals and stablecoin cap", () => {
    const g = normalizeGlobal(CgGlobal.parse(globalFixture), "usd", 180e9);
    expect(g.totalMarketCap).toBe(2.5e12);
    expect(g.btcDominance).toBe(55.2);
    expect(g.totalExBtc).toBeCloseTo(2.5e12 * 0.448);
    expect(g.totalExBtcEth).toBeCloseTo(2.5e12 * (1 - 0.683));
    expect(g.stablecoinMarketCap).toBe(180e9);
    expect(g.updatedAt).toBe(new Date(1794160000 * 1000).toISOString());
  });

  it("converts stablecoin cap into the selected currency via the total-cap ratio", () => {
    const g = normalizeGlobal(CgGlobal.parse(globalFixture), "eur", 180e9);
    expect(g.stablecoinMarketCap).toBeCloseTo(180e9 * (2.3 / 2.5));
  });

  it("returns null for a currency the provider did not supply", () => {
    const g = normalizeGlobal(CgGlobal.parse(globalFixture), "jpy", 180e9);
    expect(g.totalMarketCap).toBeNull();
    expect(g.stablecoinMarketCap).toBeNull();
  });

  it("normalizes coin detail, sanitizes text/URLs and drops anomalous tickers", () => {
    const c = normalizeCoin(CgCoin.parse(coinFixture), "usd");
    expect(c.price).toBe(3500);
    expect(c.change14d).toBeNull(); // empty map
    expect(c.description).not.toMatch(/<|script|alert/);
    expect(c.description).toContain("Second & para.");
    expect(c.categories).toEqual(["Smart Contract Platform", "Layer 1 (L1)"]);
    expect(c.platforms).toEqual([]);
    expect(c.explorers).toEqual(["https://etherscan.io/"]);
    expect(c.tickers.map((t) => t.exchangeId)).toEqual(["gdax", "binance"]); // sorted by USD volume, anomaly removed
  });

  it("stripHtml removes tags and scripts", () => {
    expect(stripHtml('<p>Hi <b>there</b></p><script>x()</script>')).toBe("Hi there");
  });
});

describe("buildChart", () => {
  it("sorts, de-duplicates and drops malformed candles; aligns rolling volume", () => {
    const ohlc: [number, number | null, number | null, number | null, number | null][] = [
      [3_000_000, 3, 4, 2, 3.5],
      [1_000_000, 1, 2, 0.5, 1.5],
      [1_000_000, 1, 2, 0.5, 1.5], // duplicate
      [2_000_000, 2, 1, 3, 2], // high < low → invalid
      [4_000_000, null, 1, 1, 1], // missing
    ];
    const vols: [number, number | null][] = [[500_000, 10], [1_000_000, 11], [2_500_000, 12]];
    const c = buildChart(ohlc, vols, "4 hours");
    expect(c.candles.map((x) => x.time)).toEqual([1000, 3000]);
    expect(c.volumes).toEqual([{ time: 1000, value: 11 }, { time: 3000, value: 12 }]);
    expect(c.volumeKind).toBe("rolling-24h");
    expect(c.candleTimeConvention).toBe("close");
  });

  it("handles empty history", () => {
    expect(buildChart([], [], "30 minutes")).toMatchObject({ candles: [], volumes: [] });
  });
});

describe("CoinGeckoProvider HTTP behaviour", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
  });
  const make = (plan: "public" | "demo" | "pro" = "demo") =>
    new CoinGeckoProvider({ plan, apiKey: plan === "public" ? undefined : "test-key", ratePerMin: 600, fetchImpl: fetchMock as unknown as typeof fetch });

  it("sends the demo key header to the public host", async () => {
    fetchMock.mockResolvedValue(jsonRes(marketsFixture));
    await make("demo").getMarkets({ currency: "usd", page: 1, perPage: 100 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("https://api.coingecko.com/api/v3/coins/markets");
    expect(String(url)).toContain("price_change_percentage=1h%2C24h%2C7d%2C30d%2C1y");
    expect(init.headers["x-cg-demo-api-key"]).toBe("test-key");
  });

  it("uses the pro host and header for pro plans, and allows full history", async () => {
    fetchMock.mockResolvedValue(jsonRes(marketsFixture));
    const p = make("pro");
    await p.getMarkets({ currency: "usd", page: 1, perPage: 10 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("https://pro-api.coingecko.com/api/v3/");
    expect(init.headers["x-cg-pro-api-key"]).toBe("test-key");
    expect(p.capabilities().maxHistoryDays).toBeNull();
  });

  it("caps 'max' range to 365 days on non-pro plans", async () => {
    fetchMock.mockImplementation(async (url: URL) => (String(url).includes("/ohlc") ? jsonRes([[1000, 1, 2, 0.5, 1.5]]) : jsonRes({ prices: [], total_volumes: [] })));
    await make("public").getChart("bitcoin", "usd", "max");
    for (const [url] of fetchMock.mock.calls) expect(String(url)).toContain("days=365");
  });

  it("maps 429 to RateLimitedError and honours Retry-After", async () => {
    fetchMock.mockResolvedValue(jsonRes({}, 429, { "retry-after": "30" }));
    const p = make();
    await expect(p.getGlobal("usd")).rejects.toBeInstanceOf(RateLimitedError);
    // Subsequent calls fail fast without hitting the network.
    fetchMock.mockClear();
    await expect(p.getMarkets({ currency: "usd", page: 1, perPage: 10 })).rejects.toBeInstanceOf(RateLimitedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads with ValidationError", async () => {
    fetchMock.mockResolvedValue(jsonRes([{ id: 42 }]));
    await expect(make().getMarkets({ currency: "usd", page: 1, perPage: 10 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("maps 404 to NotFoundError and 5xx / network errors to ProviderError", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ error: "coin not found" }, 404));
    await expect(make().getCoin("nope", "usd")).rejects.toBeInstanceOf(NotFoundError);
    fetchMock.mockResolvedValueOnce(jsonRes({}, 503));
    await expect(make().getCoin("bitcoin", "usd")).rejects.toBeInstanceOf(ProviderError);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(make().getCoin("bitcoin", "usd")).rejects.toBeInstanceOf(ProviderError);
  });

  it("still returns global stats when the categories call fails", async () => {
    fetchMock.mockImplementation(async (url: URL) => (String(url).includes("/categories") ? jsonRes({}, 500) : jsonRes(globalFixture)));
    const g = await make().getGlobal("usd");
    expect(g.totalMarketCap).toBe(2.5e12);
    expect(g.stablecoinMarketCap).toBeNull();
  });

  it("reads the stablecoin category when available", async () => {
    fetchMock.mockImplementation(async (url: URL) => (String(url).includes("/categories") ? jsonRes(categoriesFixture) : jsonRes(globalFixture)));
    expect((await make().getGlobal("usd")).stablecoinMarketCap).toBe(180e9);
  });

  it("searches by EVM contract address across platforms", async () => {
    fetchMock.mockImplementation(async (url: URL) =>
      String(url).includes("/coins/ethereum/contract/") ? jsonRes({ ...coinFixture, id: "usd-coin", symbol: "usdc", name: "USDC" }) : jsonRes({ error: "not found" }, 404),
    );
    const r = await make().search("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    expect(r).toEqual([expect.objectContaining({ id: "usd-coin", matchedBy: "contract", chain: "ethereum" })]);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  });
});
