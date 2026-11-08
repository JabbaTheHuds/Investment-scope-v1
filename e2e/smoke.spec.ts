import { expect, test } from "@playwright/test";

// Runs against DATA_MODE=demo (see playwright.config.ts) — synthetic, fictional assets.

test("overview shows demo banner, global stats and top assets", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "DEMO MODE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Market Overview" })).toBeVisible();
  await expect(page.getByText("Total market cap")).toBeVisible();
  await expect(page.getByRole("table", { name: /Top 25 assets/ }).getByRole("link").first()).toBeVisible();
  await expect(page.getByText(/Synthetic demo data · generated/).first()).toBeVisible();
});

test("search navigates to a coin page with a rendered chart", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  await page.keyboard.type("aurora");
  const option = page.getByRole("option", { name: /Aurora Demo/ });
  await expect(option).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/coins\/demo-aurora/);
  await expect(page.getByRole("heading", { name: "Aurora Demo", exact: true })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/candles · 4 hours granularity/)).toBeVisible();
  await page.getByRole("button", { name: "7D" }).click();
  await expect(page.getByText(/candles · 4 hours granularity/)).toBeVisible();
  await expect(page.getByText("Indicator snapshot")).toBeVisible();
});

test("markets table sorts and paginates", async ({ page }) => {
  await page.goto("/markets");
  const table = page.getByRole("table", { name: /Cryptocurrency markets, page 1/ });
  await expect(table.locator("tbody tr").first()).toBeVisible();
  await table.getByRole("button", { name: "24h", exact: true }).click();
  await expect(table.getByRole("columnheader", { name: "24h", exact: true })).toHaveAttribute("aria-sort", "descending");
});

test("favourites persist across reloads", async ({ page }) => {
  await page.goto("/markets");
  await page.getByRole("button", { name: /Add .* to favourites/ }).first().click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Remove .* from favourites/ }).first()).toBeVisible();
});

test("planned sections are honest placeholders and unknown routes 404", async ({ page }) => {
  await page.goto("/analyst");
  await expect(page.getByText("Planned · Phase 3")).toBeVisible();
  const res = await page.goto("/definitely-not-a-page");
  expect(res?.status()).toBe(404);
});

test("API validates input and returns 404 for unknown assets", async ({ request }) => {
  expect((await request.get("/api/markets?perPage=9999")).status()).toBe(400);
  expect((await request.get("/api/coins/..%2Fetc")).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get("/api/coins/not-a-real-asset")).status()).toBe(404);
  expect((await request.get("/api/search?q=%3Cscript%3E")).status()).toBe(400);
});
