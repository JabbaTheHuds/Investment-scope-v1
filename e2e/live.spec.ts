import { expect, test, type Page } from "@playwright/test";

// Live mode against the local CoinGecko stand-in (e2e/fake-coingecko.mjs).
const FAKE = "http://127.0.0.1:3199/api/v3/__control";
const setPrefs = (page: Page, prefs: object) =>
  page.addInitScript((p) => {
    if (!sessionStorage.getItem("__prefsSet")) {
      localStorage.setItem("cryptoscope:prefs:v1", JSON.stringify(p));
      sessionStorage.setItem("__prefsSet", "1");
    }
  }, prefs);

test.afterEach(async ({ request }) => {
  await request.get(`${FAKE}?fail=0`);
});

const totalCap = (page: Page) => page.getByText("$2.5T", { exact: true });

test("overview shows provider data with attribution and no demo banner", async ({ page }) => {
  await page.goto("/");
  await expect(totalCap(page)).toBeVisible();
  await expect(page.getByText("56.00%")).toBeVisible();
  await expect(page.getByText(/DEMO MODE/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Data provided by CoinGecko" })).toBeVisible();
  await expect(page.getByText(/Updated (just now|\d+ seconds ago)/).first()).toBeVisible();
  await expect(page.getByText("Top 250 assets by market cap").first()).toBeVisible();
  await expect(page.getByText(/rose and \d+ fell over 24h/)).toBeVisible();
  await expect(page.getByRole("table", { name: /Top 25 assets/ }).getByRole("link", { name: /Bitcoin/ })).toBeVisible();
});

test("markets keeps assets with the same ticker distinct and paginates to the end", async ({ page }) => {
  await page.goto("/markets");
  const table = page.getByRole("table", { name: /page 1/ });
  await expect(table.getByRole("link", { name: "Bitcoin BTC", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: "Asset 7 BTC", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Page 2 · ranks 101–200")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Page 3 · ranks 201–260")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next →" })).toBeDisabled();
});

test("coin page renders stats, chart, venues and sanitized description", async ({ page }) => {
  await page.goto("/coins/bitcoin");
  await expect(page.getByRole("heading", { name: "Bitcoin", exact: true })).toBeVisible();
  await expect(page.getByText("$70,000.00").first()).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/candles · 4 hours granularity/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Max" })).toBeDisabled();
  await expect(page.getByRole("cell", { name: /Coinbase Exchange/ })).toBeVisible();
  await expect(page.getByText("Bitcoin is a test asset.")).toBeVisible();
  // Date-only genesis must not shift a day in negative-offset time zones.
  await expect(page.getByText("Jan 3, 2009")).toBeVisible();
  await expect(page.getByText("Indicator snapshot")).toBeVisible();
  await expect(page.getByText(/RSI \(14\)/)).toBeVisible();
});

test("ids containing dots and underscores work", async ({ page }) => {
  await page.goto("/coins/wrapped.token_x");
  await expect(page.getByRole("heading", { name: "Wrapped Token X", exact: true })).toBeVisible();
});

test("unknown asset shows not-found", async ({ page }) => {
  await page.goto("/coins/no-such-coin");
  await expect(page.getByText("Asset not found")).toBeVisible();
});

test("search by name and by contract address", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: /Search assets/ });
  await box.fill("ethereum");
  await page.getByRole("option", { name: /Ethereum/ }).click();
  await expect(page).toHaveURL(/\/coins\/ethereum$/);
  await box.fill("0x" + "AB".repeat(20));
  const opt = page.getByRole("option", { name: /Asset 3/ });
  await expect(opt).toContainText("contract · ethereum");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/coins\/asset-3$/);
});

test("saved currency is used from the first request", async ({ page }) => {
  await setPrefs(page, { currency: "eur" });
  const usdCalls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/coins/bitcoin?currency=usd") && usdCalls.push(r.url()));
  await page.goto("/coins/bitcoin");
  await expect(page.getByText("€64,400.00").first()).toBeVisible();
  expect(usdCalls).toEqual([]);
});

test("corrupted saved preferences do not break the app", async ({ page }) => {
  await setPrefs(page, { chartRange: "9999", dashboard: "oops", overlays: 5, theme: "neon", currency: "xyz" });
  await page.goto("/coins/ethereum");
  await expect(page.getByText(/candles · 4 hours granularity/)).toBeVisible();
  await page.goto("/");
  await expect(totalCap(page)).toBeVisible();
});

test("provider outage shows an explicit error, then recovers on retry", async ({ page, request }) => {
  await request.get(`${FAKE}?fail=1`);
  await setPrefs(page, { currency: "chf" }); // currency not yet cached by the server
  await page.goto("/coins/ethereum");
  await expect(page.getByText(/CoinGecko is currently unavailable/).first()).toBeVisible();
  await expect(page.getByText("Unavailable — no data received").first()).toBeVisible();
  await request.get(`${FAKE}?fail=0`);
  await page.getByRole("button", { name: "Retry" }).first().click();
  await expect(page.getByRole("heading", { name: "Ethereum", exact: true })).toBeVisible();
  await expect(page.getByText(/Updated (just now|\d+ seconds ago)/).first()).toBeVisible();
});

test("status page reports the provider as operational", async ({ page }) => {
  await page.goto("/");
  await expect(totalCap(page)).toBeVisible();
  await page.goto("/status");
  await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("Operational")).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("no horizontal scrolling and the menu works", async ({ page }) => {
    for (const path of ["/", "/markets", "/coins/bitcoin", "/settings", "/status", "/coins", "/analyst"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(w, `horizontal overflow on ${path}`).toBeLessThanOrEqual(390);
    }
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Markets", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Open navigation" }).tap();
    await page.getByRole("link", { name: "Markets", exact: true }).tap();
    await expect(page).toHaveURL(/\/markets$/);
    await expect(page.getByRole("link", { name: "Markets", exact: true })).toBeHidden();
  });

  test("tapping a search result opens the coin", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: /Search assets/ }).fill("bitcoin");
    await page.getByRole("option", { name: /^Bitcoin/ }).tap();
    await expect(page).toHaveURL(/\/coins\/bitcoin$/);
  });
});
