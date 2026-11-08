import "server-only";
import { serverConfig } from "@/lib/config";
import type { MarketDataProvider } from "@/lib/market/types";
import { CoinGeckoProvider } from "./coingecko/provider";
import { DemoProvider } from "./demo/provider";

const g = globalThis as unknown as { __cryptoscopeProvider?: MarketDataProvider };

/**
 * Returns the configured market-data provider. Live mode NEVER falls back to demo
 * data: if the live provider fails, the UI shows stale/error states instead.
 */
export function getProvider(): MarketDataProvider {
  if (g.__cryptoscopeProvider) return g.__cryptoscopeProvider;
  const cfg = serverConfig();
  g.__cryptoscopeProvider =
    cfg.DATA_MODE === "demo"
      ? new DemoProvider()
      : new CoinGeckoProvider({ plan: cfg.COINGECKO_PLAN, apiKey: cfg.COINGECKO_API_KEY, ratePerMin: cfg.COINGECKO_RATE_LIMIT_PER_MIN, baseUrl: cfg.COINGECKO_BASE_URL });
  return g.__cryptoscopeProvider;
}
