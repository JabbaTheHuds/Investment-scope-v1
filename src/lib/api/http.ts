import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { WindowLimiter } from "@/lib/cache/token-bucket";
import { serverConfig } from "@/lib/config";
import { NotFoundError, ProviderError, RateLimitedError } from "@/lib/market/errors";
import { MarketService } from "@/lib/market/service";
import { SUPPORTED_CURRENCIES } from "@/lib/market/types";
import { getProvider } from "@/lib/providers";

const g = globalThis as unknown as { __cryptoscopeLimiter?: WindowLimiter };

function limiter() {
  return (g.__cryptoscopeLimiter ??= new WindowLimiter(serverConfig().API_RATE_LIMIT_PER_MIN, 60_000));
}

function clientKey(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export const CurrencyParam = z.enum(SUPPORTED_CURRENCIES).default("usd");
export const CoinIdParam = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/, "invalid asset id");

export function service() {
  return new MarketService(getProvider());
}

export function jsonError(status: number, code: string, message: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...extraHeaders } });
}

/**
 * Wraps an API handler with inbound rate limiting, input validation errors and
 * consistent mapping of provider failures. Internal error details are not leaked.
 */
export function apiHandler<C>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C) => {
    const rl = limiter().check(clientKey(req));
    if (!rl.ok) return jsonError(429, "rate_limited", "Too many requests", { "retry-after": String(rl.retryAfterSec) });
    try {
      const body = await fn(req, ctx);
      return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      if (err instanceof z.ZodError) return jsonError(400, "bad_request", err.issues.map((i) => `${i.path.join(".") || "param"}: ${i.message}`).join("; "));
      if (err instanceof NotFoundError) return jsonError(404, "not_found", "Asset not found");
      if (err instanceof RateLimitedError)
        return jsonError(503, "provider_rate_limited", `${err.provider} rate limit reached and no cached data is available yet. Try again shortly.`, { "retry-after": String(err.retryAfterSec ?? 30) });
      if (err instanceof ProviderError) return jsonError(502, "provider_unavailable", `${err.provider} is currently unavailable and no cached data exists.`);
      console.error("[api] unexpected error", err);
      return jsonError(500, "internal_error", "Unexpected server error");
    }
  };
}
