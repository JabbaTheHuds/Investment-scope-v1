/** Trimmed fixtures matching the documented CoinGecko v3 response shapes. */
export const marketsFixture = [
  {
    id: "bitcoin", symbol: "btc", name: "Bitcoin", image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    current_price: 70000, market_cap: 1_380_000_000_000, market_cap_rank: 1, fully_diluted_valuation: 1_470_000_000_000,
    total_volume: 30_000_000_000, high_24h: 71000, low_24h: 68500, price_change_24h: 1000, price_change_percentage_24h: 1.45,
    market_cap_change_24h: 19_000_000_000, market_cap_change_percentage_24h: 1.4, circulating_supply: 19_700_000, total_supply: 21_000_000, max_supply: 21_000_000,
    ath: 73738, ath_change_percentage: -5.07, ath_date: "2024-03-14T07:10:36.635Z", atl: 67.81, atl_change_percentage: 103000, atl_date: "2013-07-06T00:00:00.000Z",
    roi: null, last_updated: "2026-11-08T18:00:00.000Z", sparkline_in_7d: { price: [68000, 68500, null, 69000, 70000] },
    price_change_percentage_1h_in_currency: 0.12, price_change_percentage_24h_in_currency: 1.45, price_change_percentage_7d_in_currency: 3.2,
    price_change_percentage_30d_in_currency: -2.1, price_change_percentage_1y_in_currency: 80.5,
  },
  {
    id: "obscure-token", symbol: "btc", name: "Bitcoin Imitation", image: null,
    current_price: 0.0012, market_cap: null, market_cap_rank: null, fully_diluted_valuation: null, total_volume: 1200,
    high_24h: null, low_24h: null, price_change_percentage_24h: null, market_cap_change_24h: null,
    circulating_supply: 0, total_supply: null, max_supply: null, ath: null, ath_change_percentage: null, ath_date: null, atl: null, atl_change_percentage: null, atl_date: null,
    last_updated: null, sparkline_in_7d: { price: [] },
  },
];

export const globalFixture = {
  data: {
    active_cryptocurrencies: 15000, upcoming_icos: 0, ongoing_icos: 49, ended_icos: 3376, markets: 1200,
    total_market_cap: { usd: 2_500_000_000_000, eur: 2_300_000_000_000 },
    total_volume: { usd: 90_000_000_000, eur: 82_000_000_000 },
    market_cap_percentage: { btc: 55.2, eth: 13.1, usdt: 4.4 },
    market_cap_change_percentage_24h_usd: 1.23,
    updated_at: 1794160000,
  },
};

export const categoriesFixture = [
  { id: "stablecoins", name: "Stablecoins", market_cap: 180_000_000_000, updated_at: "2026-11-08T17:55:00Z" },
  { id: "layer-1", name: "Layer 1 (L1)", market_cap: 2_000_000_000_000, updated_at: "2026-11-08T17:55:00Z" },
];

export const coinFixture = {
  id: "ethereum", symbol: "eth", name: "Ethereum", asset_platform_id: null,
  platforms: { "": "" }, categories: ["Smart Contract Platform", null, "Layer 1 (L1)"],
  description: { en: 'Ethereum is a <a href="https://x.example">global</a> platform.<script>alert(1)</script>\r\n\r\nSecond &amp; para.' },
  links: { homepage: ["https://www.ethereum.org/", "", ""], blockchain_site: ["https://etherscan.io/", "javascript:alert(1)", ""] },
  image: { thumb: "t.png", small: "s.png", large: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png" },
  genesis_date: "2015-07-30", hashing_algorithm: "Ethash", market_cap_rank: 2,
  market_data: {
    current_price: { usd: 3500, eur: 3200 }, ath: { usd: 4878 }, ath_change_percentage: { usd: -28.2 }, ath_date: { usd: "2021-11-10T14:24:19.604Z" },
    atl: { usd: 0.43 }, atl_change_percentage: { usd: 800000 }, atl_date: { usd: "2015-10-20T00:00:00.000Z" },
    market_cap: { usd: 420_000_000_000 }, fully_diluted_valuation: { usd: 420_000_000_000 }, total_volume: { usd: 15_000_000_000 },
    high_24h: { usd: 3550 }, low_24h: { usd: 3400 }, market_cap_change_24h_in_currency: { usd: 5_000_000_000 },
    price_change_percentage_1h_in_currency: { usd: 0.1 }, price_change_percentage_24h_in_currency: { usd: 1.2 },
    price_change_percentage_7d_in_currency: { usd: -3 }, price_change_percentage_14d_in_currency: {},
    price_change_percentage_30d_in_currency: { usd: 5 }, price_change_percentage_60d_in_currency: { usd: 7 },
    price_change_percentage_200d_in_currency: { usd: 20 }, price_change_percentage_1y_in_currency: { usd: 40 },
    circulating_supply: 120_000_000, total_supply: 120_000_000, max_supply: null, last_updated: "2026-11-08T18:00:00.000Z",
  },
  tickers: [
    { base: "ETH", target: "USDT", market: { name: "Binance", identifier: "binance", has_trading_incentive: false }, last: 3501, volume: 100000, converted_volume: { usd: 350_000_000 }, trust_score: "green", bid_ask_spread_percentage: 0.01, last_traded_at: "2026-11-08T17:59:00Z", trade_url: "https://www.binance.com/en/trade/ETH_USDT", is_anomaly: false, is_stale: false },
    { base: "ETH", target: "USD", market: { name: "Coinbase Exchange", identifier: "gdax", has_trading_incentive: false }, last: 3499, converted_volume: { usd: 500_000_000 }, trust_score: "green", bid_ask_spread_percentage: 0.02, last_traded_at: "2026-11-08T17:59:30Z", trade_url: null, is_anomaly: false, is_stale: false },
    { base: "ETH", target: "XYZ", market: { name: "Sketchy", identifier: "sketchy" }, last: 9999, converted_volume: { usd: 9_000_000_000 }, trust_score: "red", bid_ask_spread_percentage: 5, last_traded_at: null, trade_url: "javascript:alert(1)", is_anomaly: true, is_stale: true },
  ],
  last_updated: "2026-11-08T18:00:00.000Z",
};
