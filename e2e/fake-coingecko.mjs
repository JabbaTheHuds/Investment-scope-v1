// Local stand-in for the CoinGecko v3 API (documented response shapes) used by the
// live-mode E2E suite, so the real live code path can be exercised without network access.
// Control: GET /__control?fail=1|0  toggles a simulated outage (HTTP 503 on every endpoint).
import http from "node:http";

const PORT = Number(process.env.FAKE_CG_PORT ?? 3199);
let failing = false;
const NOW = Date.now();

const assets = Array.from({ length: 260 }, (_, i) => {
  const id = i === 0 ? "bitcoin" : i === 1 ? "ethereum" : i === 2 ? "wrapped.token_x" : `asset-${i}`;
  const name = i === 0 ? "Bitcoin" : i === 1 ? "Ethereum" : i === 2 ? "Wrapped Token X" : `Asset ${i}`;
  // Duplicate ticker on purpose: asset-7 also uses "BTC".
  const symbol = i === 0 || i === 7 ? "btc" : i === 1 ? "eth" : `a${i}`;
  const price = i === 0 ? 70000 : i === 1 ? 3500 : 100 / (i + 1);
  const cap = 1.4e12 / Math.pow(i + 1, 1.3);
  const ch = Math.sin(i * 1.7) * 8; // deterministic mix of gainers and losers
  return { id, name, symbol, price, cap, ch };
});

function marketRow(a, idx) {
  return {
    id: a.id, symbol: a.symbol, name: a.name, image: null,
    current_price: a.price, market_cap: a.cap, market_cap_rank: idx + 1, fully_diluted_valuation: a.cap * 1.1,
    total_volume: a.cap * 0.05, high_24h: a.price * 1.03, low_24h: a.price * 0.97,
    price_change_24h: (a.price * a.ch) / 100, price_change_percentage_24h: a.ch,
    market_cap_change_24h: (a.cap * a.ch) / 100, market_cap_change_percentage_24h: a.ch,
    circulating_supply: a.cap / a.price, total_supply: (a.cap / a.price) * 1.1, max_supply: idx % 2 ? null : (a.cap / a.price) * 1.2,
    ath: a.price * 1.5, ath_change_percentage: -33.3, ath_date: "2025-03-14T07:10:36.635Z",
    atl: a.price * 0.01, atl_change_percentage: 9900, atl_date: "2019-07-06T00:00:00.000Z", roi: null,
    last_updated: new Date().toISOString(),
    sparkline_in_7d: { price: Array.from({ length: 168 }, (_, k) => a.price * (1 + Math.sin(k / 10 + idx) * 0.05)) },
    price_change_percentage_1h_in_currency: a.ch / 10, price_change_percentage_24h_in_currency: a.ch,
    price_change_percentage_7d_in_currency: a.ch * 1.5, price_change_percentage_30d_in_currency: -a.ch,
    price_change_percentage_1y_in_currency: a.ch * 5,
  };
}

function coin(a, idx) {
  const usd = (v) => ({ usd: v, eur: v * 0.92 });
  return {
    id: a.id, symbol: a.symbol, name: a.name, asset_platform_id: null,
    platforms: idx === 1 ? { "": "" } : { ethereum: "0x" + "ab".repeat(20) },
    categories: ["Test Category"], description: { en: `${a.name} is a <a href="https://example.com">test</a> asset.` },
    links: { homepage: ["https://example.com", ""], blockchain_site: ["https://etherscan.io/", ""] },
    image: { thumb: null, small: null, large: null },
    genesis_date: idx === 0 ? "2009-01-03" : null, hashing_algorithm: idx === 0 ? "SHA-256" : null,
    market_cap_rank: idx + 1,
    market_data: {
      current_price: usd(a.price), ath: usd(a.price * 1.5), ath_change_percentage: usd(-33.3),
      ath_date: { usd: "2025-03-14T07:10:36.635Z", eur: "2025-03-14T07:10:36.635Z" },
      atl: usd(a.price * 0.01), atl_change_percentage: usd(9900), atl_date: { usd: "2019-07-06T00:00:00.000Z" },
      market_cap: usd(a.cap), fully_diluted_valuation: usd(a.cap * 1.1), total_volume: usd(a.cap * 0.05),
      high_24h: usd(a.price * 1.03), low_24h: usd(a.price * 0.97), market_cap_change_24h_in_currency: usd((a.cap * a.ch) / 100),
      price_change_percentage_1h_in_currency: usd(a.ch / 10), price_change_percentage_24h_in_currency: usd(a.ch),
      price_change_percentage_7d_in_currency: usd(a.ch * 1.5), price_change_percentage_14d_in_currency: {},
      price_change_percentage_30d_in_currency: usd(-a.ch), price_change_percentage_60d_in_currency: usd(2),
      price_change_percentage_200d_in_currency: usd(20), price_change_percentage_1y_in_currency: usd(a.ch * 5),
      circulating_supply: a.cap / a.price, total_supply: (a.cap / a.price) * 1.1, max_supply: null,
      last_updated: new Date().toISOString(),
    },
    tickers: [
      { base: a.symbol.toUpperCase(), target: "USD", market: { name: "Coinbase Exchange", identifier: "gdax", has_trading_incentive: false }, last: a.price, volume: 1000, converted_volume: { usd: a.cap * 0.01 }, trust_score: "green", bid_ask_spread_percentage: 0.01, last_traded_at: new Date().toISOString(), trade_url: "https://www.coinbase.com/", is_anomaly: false, is_stale: false },
      { base: a.symbol.toUpperCase(), target: "USDT", market: { name: "Binance", identifier: "binance", has_trading_incentive: false }, last: a.price * 1.001, volume: 2000, converted_volume: { usd: a.cap * 0.02 }, trust_score: "green", bid_ask_spread_percentage: 0.02, last_traded_at: new Date().toISOString(), trade_url: null, is_anomaly: false, is_stale: false },
    ],
    last_updated: new Date().toISOString(),
  };
}

function ohlc(a, days) {
  const d = days === "max" ? 365 : Number(days);
  const step = d <= 2 ? 1800e3 : d <= 30 ? 4 * 3600e3 : 4 * 86400e3;
  const n = Math.floor((d * 86400e3) / step);
  const out = [];
  for (let k = n; k >= 1; k--) {
    const t = Math.floor((NOW - k * step) / step) * step;
    const base = a.price * (1 + Math.sin(k / 7) * 0.08);
    const o = base * 0.995, c = base * 1.004;
    out.push([t, o, Math.max(o, c) * 1.006, Math.min(o, c) * 0.994, c]);
  }
  return out;
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname.replace(/^\/api\/v3/, "");
    if (p === "/__control") {
      failing = url.searchParams.get("fail") === "1";
      return send(res, 200, { failing });
    }
    if (p === "/ping") return send(res, 200, { gecko_says: "(V3) To the Moon!" });
    if (failing) return send(res, 503, { error: "simulated outage" });

    if (p === "/coins/markets") {
      const per = Number(url.searchParams.get("per_page") ?? 100);
      const page = Number(url.searchParams.get("page") ?? 1);
      return send(res, 200, assets.slice((page - 1) * per, page * per).map((a, i) => marketRow(a, (page - 1) * per + i)));
    }
    if (p === "/global") {
      return send(res, 200, { data: { active_cryptocurrencies: 17000, markets: 1300, total_market_cap: { usd: 2.5e12, eur: 2.3e12 }, total_volume: { usd: 9e10, eur: 8.3e10 }, market_cap_percentage: { btc: 56, eth: 12 }, market_cap_change_percentage_24h_usd: 1.2, updated_at: Math.floor(Date.now() / 1000) } });
    }
    if (p === "/coins/categories") return send(res, 200, [{ id: "stablecoins", name: "Stablecoins", market_cap: 2e11, updated_at: new Date().toISOString() }]);
    if (p === "/search") {
      const q = (url.searchParams.get("query") ?? "").toLowerCase();
      return send(res, 200, { coins: assets.filter((a) => a.name.toLowerCase().includes(q) || a.symbol.includes(q)).slice(0, 10).map((a) => ({ id: a.id, name: a.name, api_symbol: a.id, symbol: a.symbol.toUpperCase(), market_cap_rank: assets.indexOf(a) + 1, thumb: null, large: null })), exchanges: [], categories: [], nfts: [] });
    }
    let m = p.match(/^\/coins\/([^/]+)\/contract\/([^/]+)$/);
    if (m) {
      if (m[1] === "ethereum" && m[2] === "0x" + "ab".repeat(20)) return send(res, 200, coin(assets[3], 3));
      return send(res, 404, { error: "coin not found" });
    }
    m = p.match(/^\/coins\/([^/]+)(\/ohlc|\/market_chart)?$/);
    if (m) {
      const idx = assets.findIndex((a) => a.id === decodeURIComponent(m[1]));
      if (idx < 0) return send(res, 404, { error: "coin not found" });
      const a = assets[idx];
      if (!m[2]) return send(res, 200, coin(a, idx));
      const candles = ohlc(a, url.searchParams.get("days") ?? "30");
      if (m[2] === "/ohlc") return send(res, 200, candles);
      return send(res, 200, { prices: candles.map((c) => [c[0], c[4]]), market_caps: [], total_volumes: candles.map((c) => [c[0] - 60000, a.cap * 0.05]) });
    }
    send(res, 404, { error: "unknown endpoint" });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`fake coingecko on ${PORT}`));
