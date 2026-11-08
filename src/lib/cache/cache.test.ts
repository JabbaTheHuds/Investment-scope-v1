import { describe, expect, it, vi } from "vitest";
import { SwrCache } from "./swr-cache";
import { TokenBucket, WindowLimiter } from "./token-bucket";

const opts = { ttlMs: 1000, maxStaleMs: 5000 };

describe("SwrCache", () => {
  it("serves fresh values without reloading", async () => {
    let t = 0;
    const c = new SwrCache(100, () => t);
    const loader = vi.fn().mockResolvedValue(1);
    await c.get("k", opts, loader);
    t = 500;
    const r = await c.get("k", opts, loader);
    expect(r).toMatchObject({ value: 1, stale: false });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("refreshes after TTL", async () => {
    let t = 0;
    const c = new SwrCache(100, () => t);
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await c.get("k", opts, loader);
    t = 1500;
    expect((await c.get("k", opts, loader)).value).toBe(2);
  });

  it("serves the last good value flagged stale when refresh fails (provider outage)", async () => {
    let t = 0;
    const c = new SwrCache(100, () => t);
    await c.get("k", opts, async () => "good");
    t = 2000;
    const r = await c.get("k", opts, async () => {
      throw new Error("provider down");
    });
    expect(r).toEqual({ value: "good", fetchedAt: 0, stale: true, staleReason: "provider down" });
  });

  it("refuses to serve values older than maxStale", async () => {
    let t = 0;
    const c = new SwrCache(100, () => t);
    await c.get("k", opts, async () => "ancient");
    t = 1000 + 5001;
    await expect(c.get("k", opts, async () => { throw new Error("down"); })).rejects.toThrow("down");
  });

  it("propagates errors when nothing is cached", async () => {
    const c = new SwrCache();
    await expect(c.get("k", opts, async () => { throw new Error("x"); })).rejects.toThrow("x");
  });

  it("coalesces concurrent loads for the same key", async () => {
    const c = new SwrCache();
    let resolve!: (v: number) => void;
    const loader = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = c.get("k", opts, loader);
    const b = c.get("k", opts, loader);
    resolve(7);
    expect((await a).value).toBe(7);
    expect((await b).value).toBe(7);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("evicts beyond capacity", async () => {
    const c = new SwrCache(2);
    for (const k of ["a", "b", "c"]) await c.get(k, opts, async () => k);
    expect(c.size()).toBe(2);
  });
});

describe("TokenBucket", () => {
  it("limits bursts and refills over time", () => {
    let t = 0;
    const b = new TokenBucket(2, 1, () => t);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
    t = 1000;
    expect(b.tryAcquire()).toBe(true);
  });
  it("blocks for Retry-After", () => {
    let t = 0;
    const b = new TokenBucket(5, 5, () => t);
    b.blockFor(10);
    t = 9000;
    expect(b.tryAcquire()).toBe(false);
    t = 10_500;
    expect(b.tryAcquire()).toBe(true);
  });
});

describe("WindowLimiter", () => {
  it("allows up to the limit per window per key", () => {
    let t = 0;
    const l = new WindowLimiter(2, 1000, () => t);
    expect(l.check("a").ok).toBe(true);
    expect(l.check("a").ok).toBe(true);
    expect(l.check("a").ok).toBe(false);
    expect(l.check("b").ok).toBe(true);
    t = 1001;
    expect(l.check("a").ok).toBe(true);
  });
});
