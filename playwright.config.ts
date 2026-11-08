import { defineConfig } from "@playwright/test";

// End-to-end smoke tests run against a production build in explicit DEMO mode,
// so they never depend on (or hammer) external market-data providers.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/status`,
    reuseExistingServer: true,
    env: { DATA_MODE: "demo" },
    timeout: 120_000,
  },
});
