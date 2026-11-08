/** Regression tests for bugs found in the review pass. */
import { describe, expect, it, vi } from "vitest";
import { buildMarketSummary } from "@/components/market/summary";
import { parsePreferences } from "@/components/shell/PreferencesProvider";
import { formatDate } from "@/lib/format";
import type { GlobalResponse } from "@/lib/market/api-types";
import { NotFoundError, ProviderError, RateLimitedError, ValidationError } from "@/lib/market/errors";
import { getStatuses } from "@/lib/market/status";
import { cleanSparkline } from "@/lib/providers/coingecko/normalize";
import { CoinGeckoProvider } from "@/lib/providers/coingecko/provider";
import { marketsFixture } from "../../tests/fixtures/coingecko";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const provider = (fetchImpl: unknown, ratePerMin = 600) => new CoinGeckoProvider({ plan: "demo", apiKey: "k", ratePerMin, fetchImpl: fetchImpl as typeof fetch });

describe("market list robustness", () => {
  it("drops a malformed row instead of failing the whole page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = await provider(async () => json([...marketsFixture, { id: 7, name: null }])).getMarkets({ currency: "usd", page: 1, perPage: 100 });
    expect(rows.map((r) => r.id)).toEqual(["bitcoin", "obscure-token"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("still fails when nothing in the response is valid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(provider(async () => json([{ nope: 1 }])).getMarkets({ currency: "usd", page: 1, perPage: 10 })).rejects.toBeInstanceOf(ValidationError);
    warn.mockRestore();
  });
  it("downsamples sparklines but keeps the first and latest points", () => {
    const pts = Array.from({ length: 168 }, (_, i) => i);
    const s = cleanSparkline(pts)!;
    expect(s.length).toBe(56);
    expect(s[0]).toBe(0);
    expect(s.at(-1)).toBe(167);
    expect(cleanSparkline([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("provider error reporting", () => {
  it("explains rejected API keys", async () => {
    await expect(provider(async () => json({}, 401)).getGlobal("usd")).rejects.toThrow(/rejected the request \(401\).*COINGECKO_API_KEY/);
  });
  it("contract search surfaces failures instead of claiming no match", async () => {
    const f = async (url: URL) => (String(url).includes("/coins/ethereum/") ? json({}, 503) : json({}, 404));
    await expect(provider(f).search("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).rejects.toBeInstanceOf(ProviderError);
  });
  it("contract search returns [] only when every platform answered 404", async () => {
    expect(await provider(async () => json({}, 404)).search("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toEqual([]);
  });
  it("does not record local throttling as a provider failure", async () => {
    const p = provider(async () => json(marketsFixture), 1); // capacity 1 token
    await p.getMarkets({ currency: "usd", page: 1, perPage: 10 });
    const before = getStatuses().find((s) => s.id === "coingecko")!.totalFailures;
    await expect(p.getMarkets({ currency: "usd", page: 2, perPage: 10 })).rejects.toBeInstanceOf(RateLimitedError);
    expect(getStatuses().find((s) => s.id === "coingecko")!.totalFailures).toBe(before);
  });
  it("uses a configured base URL", async () => {
    const f = vi.fn(async () => json(marketsFixture));
    await new CoinGeckoProvider({ plan: "public", ratePerMin: 60, baseUrl: "http://127.0.0.1:9/api/v3/", fetchImpl: f as unknown as typeof fetch }).getMarkets({ currency: "usd", page: 1, perPage: 10 });
    expect(String((f.mock.calls[0] as unknown[])[0])).toMatch(/^http:\/\/127\.0\.0\.1:9\/api\/v3\/coins\/markets\?/);
  });
  it("NotFoundError stays distinct", () => {
    expect(new NotFoundError("x", "y")).toBeInstanceOf(ProviderError);
  });
});

describe("stored preferences", () => {
  it("returns defaults for missing or corrupt storage", () => {
    expect(parsePreferences(null).currency).toBe("usd");
    expect(parsePreferences("{not json").theme).toBe("dark");
    expect(parsePreferences("[1,2]").chartRange).toBe("30");
    expect(parsePreferences("null").overlays).toEqual(["sma20"]);
  });
  it("replaces each invalid field with its default but keeps valid ones", () => {
    const p = parsePreferences(JSON.stringify({ currency: "eur", theme: "neon", chartRange: "9999", chartType: "line", overlays: ["sma50", "bogus", "sma50"], showVolume: "yes", favorites: "bitcoin", timeZone: "Mars/Olympus", dashboard: "x" }));
    expect(p).toMatchObject({ currency: "eur", theme: "dark", chartRange: "30", chartType: "line", overlays: ["sma50"], showVolume: true, favorites: [], timeZone: "" });
    expect(p.dashboard.map((w) => w.id)).toEqual(["stats", "summary", "movers", "favorites", "table"]);
  });
  it("keeps a saved dashboard order and appends new widgets", () => {
    const p = parsePreferences(JSON.stringify({ dashboard: [{ id: "table", visible: false }, { id: "stats", visible: true }, { id: "table", visible: true }, { id: "gone", visible: true }] }));
    expect(p.dashboard).toEqual([
      { id: "table", visible: false },
      { id: "stats", visible: true },
      { id: "summary", visible: true },
      { id: "movers", visible: true },
      { id: "favorites", visible: true },
    ]);
  });
  it("accepts a valid IANA time zone", () => {
    expect(parsePreferences(JSON.stringify({ timeZone: "Asia/Tokyo" })).timeZone).toBe("Asia/Tokyo");
  });
});

describe("display", () => {
  it("does not shift date-only values across time zones", () => {
    expect(formatDate("2015-07-30", "America/Los_Angeles")).toMatch(/30/);
    expect(formatDate("2015-07-30", "Pacific/Kiritimati")).toMatch(/30/);
  });
  it("describes a flat market sensibly", () => {
    const lines = buildMarketSummary({ data: { totalMarketCap: 1e12, marketCapChange24hPct: 0.001 }, analysis: null } as unknown as GlobalResponse, "usd");
    expect(lines[0]).toMatch(/essentially unchanged/);
    const down = buildMarketSummary({ data: { totalMarketCap: 1e12, marketCapChange24hPct: -2.5 }, analysis: null } as unknown as GlobalResponse, "usd");
    expect(down[0]).toMatch(/down 2\.50%/);
  });
});
