import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, macd, rsi, sma } from "./index";

// Classic Wilder RSI example dataset (as published by StockCharts "RSI" ChartSchool article).
const WILDER = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21];

describe("sma", () => {
  it("returns null during warm-up then the rolling mean", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("handles period longer than input", () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });
  it("rejects invalid periods", () => {
    expect(() => sma([1], 0)).toThrow(RangeError);
    expect(() => sma([1], 2.5)).toThrow(RangeError);
  });
});

describe("ema", () => {
  it("seeds with SMA and applies 2/(n+1) smoothing", () => {
    const out = ema([1, 2, 3, 4, 5, 6], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(2); // SMA seed
    expect(out[3]).toBeCloseTo(3); // 4*.5 + 2*.5
    expect(out[4]).toBeCloseTo(4);
    expect(out[5]).toBeCloseTo(5);
  });
  it("is constant on a constant series", () => {
    expect(ema([7, 7, 7, 7, 7], 2).slice(1).every((v) => v === 7)).toBe(true);
  });
});

describe("rsi (Wilder)", () => {
  it("matches the published reference values", () => {
    const r = rsi(WILDER, 14);
    expect(r.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(r[14]!).toBeCloseTo(70.46, 0); // reference ≈ 70.53 (computed on rounded inputs)
    expect(r[15]!).toBeCloseTo(66.25, 0);
  });
  it("is 100 for strictly rising and 0 for strictly falling series", () => {
    const up = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(up, 14).at(-1)).toBe(100);
    expect(rsi([...up].reverse(), 14).at(-1)).toBe(0);
  });
  it("is 50 for a flat series", () => {
    expect(rsi(new Array(20).fill(5), 14).at(-1)).toBe(50);
  });
  it("stays within [0, 100]", () => {
    const noisy = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i) * 10 + (i % 7));
    for (const v of rsi(noisy, 14)) if (v != null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
  });
});

describe("bollinger", () => {
  it("uses population standard deviation", () => {
    const b = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    // mean 5, population sd 2
    expect(b.middle[7]).toBeCloseTo(5);
    expect(b.upper[7]).toBeCloseTo(9);
    expect(b.lower[7]).toBeCloseTo(1);
    expect(b.upper[6]).toBeNull();
  });
});

describe("macd", () => {
  it("is zero on a constant series and warms up correctly", () => {
    const m = macd(new Array(60).fill(10));
    expect(m.macd[24]).toBeNull();
    expect(m.macd[25]).toBeCloseTo(0);
    expect(m.signal[25 + 7]).toBeNull();
    expect(m.signal[25 + 8]).toBeCloseTo(0);
    expect(m.histogram.at(-1)).toBeCloseTo(0);
  });
  it("is positive in a steady uptrend", () => {
    const m = macd(Array.from({ length: 80 }, (_, i) => 100 + i));
    expect(m.macd.at(-1)!).toBeGreaterThan(0);
  });
});

describe("atr", () => {
  it("uses true range including gaps", () => {
    const candles = Array.from({ length: 16 }, (_, i) => ({ time: i, open: 10, high: 11, low: 9, close: 10 }));
    expect(atr(candles, 14)[14]).toBeCloseTo(2);
    // A gap-up candle: prev close 10, high 15, low 14 → TR = 5
    candles.push({ time: 16, open: 14, high: 15, low: 14, close: 14.5 });
    const a = atr(candles, 14);
    expect(a.at(-1)!).toBeCloseTo((2 * 13 + 5) / 14);
  });
});
