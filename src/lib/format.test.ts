import { describe, expect, it } from "vitest";
import { direction, formatAgo, formatCompactMoney, formatPct, formatPrice } from "./format";

describe("format", () => {
  it("renders missing values as an em dash, never zero", () => {
    expect(formatPrice(null, "usd")).toBe("—");
    expect(formatPct(undefined)).toBe("—");
    expect(formatCompactMoney(NaN, "usd")).toBe("—");
  });
  it("always shows the sign on percentages", () => {
    expect(formatPct(2.345)).toBe("+2.35%");
    expect(formatPct(-1.2)).toBe("−1.20%");
    expect(formatPct(0.0001)).toBe("0.00%");
  });
  it("uses adaptive precision for small prices", () => {
    expect(formatPrice(0.00001234, "usd", "en-US")).toBe("$0.00001234");
    expect(formatPrice(65000.5, "usd", "en-US")).toBe("$65,000.50");
  });
  it("formats crypto quote currencies with their symbols", () => {
    expect(formatPrice(0.05, "btc", "en-US")).toBe("₿0.05");
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-01-01T00:01:00Z");
    expect(formatAgo("2026-01-01T00:00:52Z", now)).toBe("8 seconds ago");
    expect(formatAgo("2026-01-01T00:00:00Z", now)).toBe("1 minute ago");
    expect(formatAgo(null, now)).toBe("unknown");
  });
  it("classifies direction", () => {
    expect(direction(1)).toBe("up");
    expect(direction(-1)).toBe("down");
    expect(direction(0)).toBe("flat");
    expect(direction(null)).toBe("unknown");
  });
});
