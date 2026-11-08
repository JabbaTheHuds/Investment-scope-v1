import { defineConfig } from "@playwright/test";

// Two suites run against a production build (`npm run build` first):
//  - demo: DATA_MODE=demo (synthetic, fictional assets)
//  - live: DATA_MODE=live against a local CoinGecko stand-in (e2e/fake-coingecko.mjs),
//          exercising the real live code path without hitting the public API.
const DEMO_PORT = 3100;
const LIVE_PORT = 3101;
const FAKE_PORT = 3199;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "demo", testMatch: /smoke\.spec\.ts/, use: { baseURL: `http://127.0.0.1:${DEMO_PORT}` } },
    { name: "live", testMatch: /(live|features)\.spec\.ts/, use: { baseURL: `http://127.0.0.1:${LIVE_PORT}` } },
  ],
  webServer: [
    {
      command: `npx next start -p ${DEMO_PORT}`,
      url: `http://127.0.0.1:${DEMO_PORT}/api/status`,
      reuseExistingServer: false,
      env: { DATA_MODE: "demo" },
      timeout: 120_000,
    },
    {
      command: `node e2e/fake-coingecko.mjs`,
      url: `http://127.0.0.1:${FAKE_PORT}/api/v3/ping`,
      reuseExistingServer: false,
      env: { FAKE_CG_PORT: String(FAKE_PORT) },
    },
    {
      command: `npx next start -p ${LIVE_PORT}`,
      url: `http://127.0.0.1:${LIVE_PORT}/api/status`,
      reuseExistingServer: false,
      env: {
        DATA_MODE: "live",
        COINGECKO_PLAN: "public",
        COINGECKO_BASE_URL: `http://127.0.0.1:${FAKE_PORT}/api/v3`,
        COINGECKO_RATE_LIMIT_PER_MIN: "600",
        API_RATE_LIMIT_PER_MIN: "10000",
      },
      timeout: 120_000,
    },
  ],
});
