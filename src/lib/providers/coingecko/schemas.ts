/**
 * Zod schemas for the subset of CoinGecko API v3 responses we consume.
 * Reference: https://docs.coingecko.com/reference/introduction
 * Fields are nullable/optional because CoinGecko omits or nulls them for many assets.
 */
import { z } from "zod";

const num = z.number().finite().nullable().optional();
const str = z.string().nullable().optional();
const currencyMap = z.record(z.string(), z.number().nullable()).nullable().optional();
const currencyStrMap = z.record(z.string(), z.string().nullable()).nullable().optional();

export const CgMarketItem = z.object({
  id: z.string().min(1),
  symbol: z.string(),
  name: z.string(),
  image: str,
  current_price: num,
  market_cap: num,
  market_cap_rank: num,
  fully_diluted_valuation: num,
  total_volume: num,
  high_24h: num,
  low_24h: num,
  price_change_percentage_24h: num,
  market_cap_change_24h: num,
  circulating_supply: num,
  total_supply: num,
  max_supply: num,
  ath: num,
  ath_change_percentage: num,
  ath_date: str,
  atl: num,
  atl_change_percentage: num,
  atl_date: str,
  last_updated: str,
  sparkline_in_7d: z.object({ price: z.array(z.number().nullable()) }).nullable().optional(),
  price_change_percentage_1h_in_currency: num,
  price_change_percentage_24h_in_currency: num,
  price_change_percentage_7d_in_currency: num,
  price_change_percentage_30d_in_currency: num,
  price_change_percentage_1y_in_currency: num,
});
export const CgMarkets = z.array(CgMarketItem);
export type CgMarketItem = z.infer<typeof CgMarketItem>;

export const CgGlobal = z.object({
  data: z.object({
    active_cryptocurrencies: num,
    markets: num,
    total_market_cap: currencyMap,
    total_volume: currencyMap,
    market_cap_percentage: currencyMap,
    market_cap_change_percentage_24h_usd: num,
    updated_at: num,
  }),
});
export type CgGlobal = z.infer<typeof CgGlobal>;

export const CgCategories = z.array(
  z.object({ id: z.string(), name: z.string(), market_cap: num, updated_at: str }),
);

export const CgTicker = z.object({
  base: z.string(),
  target: z.string(),
  market: z.object({ name: z.string(), identifier: z.string() }),
  last: num,
  converted_volume: currencyMap,
  trust_score: str,
  bid_ask_spread_percentage: num,
  last_traded_at: str,
  trade_url: str,
  is_anomaly: z.boolean().nullable().optional(),
  is_stale: z.boolean().nullable().optional(),
});

export const CgCoin = z.object({
  id: z.string().min(1),
  symbol: z.string(),
  name: z.string(),
  platforms: z.record(z.string(), z.string().nullable()).nullable().optional(),
  categories: z.array(z.string().nullable()).nullable().optional(),
  description: z.record(z.string(), z.string().nullable()).nullable().optional(),
  links: z
    .object({
      homepage: z.array(z.string().nullable()).nullable().optional(),
      blockchain_site: z.array(z.string().nullable()).nullable().optional(),
    })
    .nullable()
    .optional(),
  image: z.object({ thumb: str, small: str, large: str }).nullable().optional(),
  genesis_date: str,
  hashing_algorithm: str,
  market_cap_rank: num,
  market_data: z
    .object({
      current_price: currencyMap,
      ath: currencyMap,
      ath_change_percentage: currencyMap,
      ath_date: currencyStrMap,
      atl: currencyMap,
      atl_change_percentage: currencyMap,
      atl_date: currencyStrMap,
      market_cap: currencyMap,
      fully_diluted_valuation: currencyMap,
      total_volume: currencyMap,
      high_24h: currencyMap,
      low_24h: currencyMap,
      market_cap_change_24h_in_currency: currencyMap,
      price_change_percentage_1h_in_currency: currencyMap,
      price_change_percentage_24h_in_currency: currencyMap,
      price_change_percentage_7d_in_currency: currencyMap,
      price_change_percentage_14d_in_currency: currencyMap,
      price_change_percentage_30d_in_currency: currencyMap,
      price_change_percentage_60d_in_currency: currencyMap,
      price_change_percentage_200d_in_currency: currencyMap,
      price_change_percentage_1y_in_currency: currencyMap,
      circulating_supply: num,
      total_supply: num,
      max_supply: num,
      sparkline_7d: z.object({ price: z.array(z.number().nullable()) }).nullable().optional(),
      last_updated: str,
    })
    .nullable()
    .optional(),
  tickers: z.array(CgTicker).nullable().optional(),
  last_updated: str,
});
export type CgCoin = z.infer<typeof CgCoin>;

/** [timestamp_ms, open, high, low, close] */
export const CgOhlc = z.array(z.tuple([z.number(), z.number().nullable(), z.number().nullable(), z.number().nullable(), z.number().nullable()]));

export const CgMarketChart = z.object({
  prices: z.array(z.tuple([z.number(), z.number().nullable()])),
  total_volumes: z.array(z.tuple([z.number(), z.number().nullable()])),
});

export const CgSearch = z.object({
  coins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      market_cap_rank: num,
      thumb: str,
    }),
  ),
});
