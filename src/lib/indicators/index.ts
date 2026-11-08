/**
 * Technical indicators. Pure functions over ascending series.
 * Output arrays are aligned with the input; warm-up positions are `null`
 * (never back-filled), so no value is shown before enough history exists.
 */
import type { Candle } from "@/lib/market/types";

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  assertPeriod(period);
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` values (standard convention). */
export function ema(values: number[], period: number): Series {
  assertPeriod(period);
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i]!;
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI with Wilder's smoothing. First value at index `period`. */
export function rsi(values: number[], period = 14): Series {
  assertPeriod(period);
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period, avgL = loss / period;
  out[period] = toRsi(avgG, avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi(avgG, avgL);
  }
  return out;
}
function toRsi(g: number, l: number) {
  if (l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}

export function bollinger(values: number[], period = 20, mult = 2): { middle: Series; upper: Series; lower: Series } {
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = middle[i]!;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (values[j]! - m) ** 2;
    const sd = Math.sqrt(v / period); // population SD, per Bollinger's definition
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { middle, upper, lower };
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: Series; signal: Series; histogram: Series } {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line: Series = values.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null));
  const start = line.findIndex((x) => x != null);
  const sig: Series = new Array(values.length).fill(null);
  if (start >= 0) {
    const sub = ema(line.slice(start) as number[], signal);
    sub.forEach((v, i) => (sig[start + i] = v));
  }
  const hist: Series = line.map((m, i) => (m != null && sig[i] != null ? m - sig[i]! : null));
  return { macd: line, signal: sig, histogram: hist };
}

/** Average True Range with Wilder's smoothing. */
export function atr(candles: Candle[], period = 14): Series {
  assertPeriod(period);
  const out: Series = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1]!.close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  let a = 0;
  for (let i = 1; i <= period; i++) a += tr[i]!;
  a /= period;
  out[period] = a;
  for (let i = period + 1; i < candles.length; i++) {
    a = (a * (period - 1) + tr[i]!) / period;
    out[i] = a;
  }
  return out;
}

function assertPeriod(p: number) {
  if (!Number.isInteger(p) || p < 1) throw new RangeError(`Invalid period: ${p}`);
}
