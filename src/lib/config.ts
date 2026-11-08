import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  DATA_MODE: z.enum(["live", "demo"]).default("live"),
  COINGECKO_PLAN: z.enum(["public", "demo", "pro"]).default("public"),
  COINGECKO_API_KEY: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  COINGECKO_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(1000).default(20),
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(100_000).default(120),
});

export type ServerConfig = z.infer<typeof EnvSchema>;

let cached: ServerConfig | undefined;

/** Parsed, validated server configuration. Secrets never leave the server. */
export function serverConfig(): ServerConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`);
  }
  const cfg = parsed.data;
  if (cfg.DATA_MODE === "live" && cfg.COINGECKO_PLAN !== "public" && !cfg.COINGECKO_API_KEY) {
    // Degrade to the keyless public API rather than failing every request.
    console.warn(`[config] COINGECKO_PLAN=${cfg.COINGECKO_PLAN} but no COINGECKO_API_KEY set — using the public (keyless) API.`);
    cfg.COINGECKO_PLAN = "public";
  }
  cached = cfg;
  return cfg;
}
