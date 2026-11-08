import { describe, expect, it } from "vitest";
import { buildMarketSummary } from "@/components/market/summary";
import { SwrCache } from "@/lib/cache/swr-cache";
import { DemoProvider } from "@/lib/providers/demo/provider";
import type { GlobalResponse } from "./api-types";
import { computeBreadth, deriveExcluding, topContributors } from "./derive";
import { ProviderError } from "./errors";
import { MarketService } from "./service";
import type { MarketDataProvider, MarketRow } from "./types";

const row = (id: string, change24h: number | null, mcChange: number | null = null): MarketRow =>
  ({ id, symbol: id.toUpperCase(), name: id, change24h, marketCapChange24h: mcChange }) as MarketRow;

describe("derive", () => {
  it("computes excluding totals and propagates missing inputs as null", () => {
    const d = deriveExcluding(100, 50, 20);
    expect(d.totalExBtc).toBeCloseTo(50);
    expect(d.totalExBtcEth).toBeCloseTo(30);
    expect(deriveExcluding(null, 50, 20)).toEqual({ totalExBtc: null, totalExBtcEth: null });
    expect(deriveExcluding(100, 50, null).totalExBtcEth).toBeNull();
  });

  it("computes breadth with a flat threshold and unknowns", () => {
    const b = computeBreadth([row("bitcoin", 1), row("a", 2), row("b", -3), row("c", 0.01), row("d", null)]);
    expect(b).toMatchObject({ sample: 5, advancers: 2, decliners: 1, unchanged: 1, unknown: 1 });
    expect(b.median24h).toBeCloseTo(0.505);
    expect(b.pctOutperformingBtc).toBeCloseTo((1 / 3) * 100);
  });

  it("ranks contributors by absolute market-cap change", () => {
    const r = topContributors([row("a", 1, 10), row("b", -1, -50), row("c", 1, 5), row("d", 1, null)], 2);
    expect(r.net).toBe(-35);
    expect(r.contributors.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("market summary", () => {
  it("flags narrow participation when cap-weighted and median moves disagree", () => {
    const g = {
      data: { totalMarketCap: 1e12, marketCapChange24hPct: 2 },
      analysis: {
        sampleDescription: "Top 250 assets by market cap",
        breadth: { sample: 250, advancers: 50, decliners: 190, unchanged: 10, unknown: 0, median24h: -1.5, pctOutperformingBtc: 10 },
        contributors: { net: 1, contributors: [] },
      },
    } as unknown as GlobalResponse;
    const lines = buildMarketSummary(g, "usd");
    expect(lines.join(" ")).toMatch(/50 rose and 190 fell/);
    expect(lines.join(" ")).toMatch(/small number of large assets/);
  });
});

describe("MarketService", () => {
  it("labels demo data as demo", async () => {
    const svc = new MarketService(new DemoProvider(() => 1_790_000_000), new SwrCache());
    const r = await svc.markets("usd", 1, 10);
    expect(r.meta.mode).toBe("demo");
    expect(r.data).toHaveLength(10);
    expect(r.data.every((x) => x.name.endsWith("Demo"))).toBe(true);
  });

  it("marks data stale (never silently current) when the provider fails after a success", async () => {
    let fail = false;
    let t = 0;
    const base = new DemoProvider(() => 1_790_000_000);
    const flaky: MarketDataProvider = Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
      getGlobal: async (c: "usd") => {
        if (fail) throw new ProviderError("upstream 503", "Demo");
        return base.getGlobal(c);
      },
    });
    const svc = new MarketService(flaky, new SwrCache(100, () => t));
    const first = await svc.global("usd");
    expect(first.meta.stale).toBe(false);
    fail = true;
    t = 61_000;
    const second = await svc.global("usd");
    expect(second.meta.stale).toBe(true);
    expect(second.meta.staleReason).toBe("upstream 503");
    expect(second.meta.fetchedAt).toBe(first.meta.fetchedAt);
  });
});

describe("DemoProvider", () => {
  const p = new DemoProvider(() => 1_790_000_000);
  it("is deterministic for a fixed clock", async () => {
    const a = await p.getMarkets({ currency: "usd", page: 1, perPage: 5 });
    const b = await new DemoProvider(() => 1_790_000_000).getMarkets({ currency: "usd", page: 1, perPage: 5 });
    expect(a.map((x) => x.price)).toEqual(b.map((x) => x.price));
  });
  it("produces valid candles", async () => {
    const c = await p.getChart("demo-aurora", "usd", "30");
    expect(c.candles.length).toBeGreaterThan(100);
    for (const k of c.candles) {
      expect(k.high).toBeGreaterThanOrEqual(Math.max(k.open, k.close));
      expect(k.low).toBeLessThanOrEqual(Math.min(k.open, k.close));
    }
    for (let i = 1; i < c.candles.length; i++) expect(c.candles[i]!.time).toBeGreaterThan(c.candles[i - 1]!.time);
  });
  it("never uses real asset names", async () => {
    const rows = await p.getMarkets({ currency: "usd", page: 1, perPage: 250 });
    expect(rows.some((r) => /bitcoin|ethereum/i.test(r.name))).toBe(false);
  });
});
