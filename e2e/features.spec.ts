import { expect, test } from "@playwright/test";

// Interactive features, run in live mode against the local CoinGecko stand-in.

test("no page throws or logs console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  for (const path of ["/", "/markets", "/markets?page=2", "/coins", "/coins/bitcoin", "/coins/ethereum", "/settings", "/status", "/analyst", "/portfolio", "/scanner"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});

test("chart: type, range, overlays, volume and PNG export", async ({ page }) => {
  await page.goto("/coins/bitcoin");
  const info = page.getByText(/\d+ candles · .* granularity/);
  await expect(info).toContainText("4 hours");
  for (const t of ["line", "area", "candles"]) {
    await page.getByRole("button", { name: t, exact: true }).click();
    await expect(page.getByRole("button", { name: t, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("canvas").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "1D" }).click();
  await expect(info).toContainText("30 minutes");
  await page.getByRole("button", { name: "90D" }).click();
  await expect(info).toContainText("4 days");
  await page.getByRole("button", { name: "30D" }).click();
  await expect(info).toContainText("4 hours");

  await page.getByText(/^Indicators \(/).click();
  await page.getByLabel("SMA 50").check();
  await page.getByLabel("Bollinger (20, 2)").check();
  await expect(page.getByText("Indicators (3)")).toBeVisible();
  await expect(page.getByText("needs 200")).toBeVisible(); // 180 candles < SMA 200 warm-up
  await page.getByLabel("Volume pane").uncheck();
  await page.getByLabel("Volume pane").check();
  // Menu closes on Escape and on an outside click.
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("SMA 50")).toBeHidden();
  await page.getByText(/^Indicators \(/).click();
  await expect(page.getByLabel("SMA 50")).toBeVisible();
  await page.getByRole("heading", { name: "Bitcoin", exact: true }).click();
  await expect(page.getByLabel("SMA 50")).toBeHidden();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/^bitcoin-30D-\d{4}-\d{2}-\d{2}\.png$/);

  // Preferences persist across reloads.
  await page.reload();
  await expect(page.getByText("Indicators (3)")).toBeVisible();
});

test("crosshair legend shows OHLC values", async ({ page }) => {
  await page.goto("/coins/bitcoin");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await expect(page.getByText(/^O\s/).first()).toBeVisible();
  await expect(page.getByText(/24h vol/)).toBeVisible();
});

test("dashboard customization hides and reorders widgets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customize dashboard" }).click();
  await page.getByRole("checkbox", { name: "Top movers" }).uncheck();
  await expect(page.getByText("Top gainers (24h)")).toHaveCount(0);
  await page.getByRole("button", { name: "Move Top assets up" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByText("Top gainers (24h)")).toHaveCount(0);
  const order = await page.locator("main h2").allInnerTexts();
  expect(order.indexOf("Top assets by market cap")).toBeLessThan(order.indexOf("Favourites"));
});

test("theme and currency switching", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Theme", { exact: true }).first().selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Quote currency").first().selectOption("btc");
  await page.goto("/coins/bitcoin");
  await expect(page.getByText(/^₿/).first()).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("favourite from coin page appears on overview", async ({ page }) => {
  await page.goto("/coins/ethereum");
  await page.getByRole("button", { name: "Add to favourites" }).click();
  await page.goto("/");
  const fav = page.locator("section", { has: page.getByRole("heading", { name: "Favourites" }) });
  await expect(fav.getByRole("link", { name: /Ethereum/ })).toBeVisible();
});

test("markets column sort orders values", async ({ page }) => {
  await page.goto("/markets");
  const table = page.getByRole("table", { name: /page 1/ });
  await table.getByRole("button", { name: "24h", exact: true }).click();
  const cells = table.locator("tbody tr td:nth-child(6)");
  await expect(cells.first()).toBeVisible();
  const vals = (await cells.allInnerTexts()).map((t) => Number(t.replace(/[▲▼%+\s]/g, "").replace("−", "-")));
  for (let i = 1; i < vals.length; i++) expect(vals[i - 1]!).toBeGreaterThanOrEqual(vals[i]!);
});

test("settings reset clears local data", async ({ page }) => {
  await page.goto("/coins/bitcoin");
  await page.getByRole("button", { name: "Add to favourites" }).click();
  await page.goto("/settings");
  await expect(page.getByText("1 favourite(s) saved in this browser.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset preferences" }).click();
  await expect(page.getByText("0 favourite(s) saved in this browser.")).toBeVisible();
});
