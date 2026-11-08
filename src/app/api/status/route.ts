import { apiHandler } from "@/lib/api/http";
import { serverConfig } from "@/lib/config";
import { marketCache } from "@/lib/cache/swr-cache";
import { getStatuses } from "@/lib/market/status";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Health & configuration summary. Never includes secrets. */
export const GET = apiHandler(async () => {
  const cfg = serverConfig();
  const p = getProvider();
  return {
    mode: cfg.DATA_MODE,
    provider: { id: p.id, label: p.label, attribution: p.attribution, capabilities: p.capabilities(), priceKind: p.priceKind },
    coingeckoPlan: cfg.DATA_MODE === "live" ? cfg.COINGECKO_PLAN : null,
    apiKeyConfigured: !!cfg.COINGECKO_API_KEY,
    sources: getStatuses(),
    cacheEntries: marketCache.size(),
    serverTime: new Date().toISOString(),
  };
});
