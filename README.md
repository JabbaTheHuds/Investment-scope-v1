# CryptoScope AI

A cryptocurrency market-intelligence platform built on real market data, transparent analytics and explicit data freshness.

> **Status: Phase 1 (Working Foundation) complete.** See [docs/ROADMAP.md](docs/ROADMAP.md) for what is built, what is planned, and current limitations.

## What works today

| Area | Details |
| --- | --- |
| **Overview dashboard** | Total market cap, 24h volume, BTC/ETH dominance, market cap excluding BTC and excluding BTC+ETH (derived), stablecoin cap, tracked assets. Breadth across the top 250 assets (advancers and decliners, median move, share beating BTC), the largest market-cap contributors, top gainers and decliners, and favourites. Widgets can be shown, hidden and reordered. |
| **Automated market summary** | A plain-language summary built only from the measured data (no AI, no inferred causes). It also flags narrow participation, when the cap-weighted market and the median asset move in opposite directions. |
| **Markets** | Paginated table on the server (100 per page) with sortable columns: price, 1h, 24h, 7d and 30d change, market cap, volume, volume/market cap, circulating supply and a 7-day sparkline. |
| **Coin analysis** | Lightweight Charts candlestick, line and area charts, ranges from 1D to 1Y (and Max where the plan allows), volume pane, SMA 20/50/200, EMA 20 and Bollinger overlays, a crosshair OHLC legend, PNG export and full screen. Also: performance from 1h to 1y, supply, all-time high and low with distance, 24h range, prices on individual exchanges (spread, trust score, last trade), contracts and links. |
| **Indicator snapshot** | RSI(14), position against SMA 20/50, and Bollinger %B, computed from the candles in the chart. Each reading has a plain-language explanation and caveats. |
| **Search** | By name, ticker or **contract address** (EVM chains and Solana). Press `/` to focus; arrow keys and Enter work. |
| **Freshness and provenance** | Every response carries source, fetch time, provider timestamp and a stale flag. The UI shows labels such as "Updated 8 seconds ago" and switches to **Stale** when a refresh fails or the data ages out. It never claims "real-time" for polled data. |
| **Resilience** | Server-side caching that keeps serving the last good data (labelled stale) if a refresh fails. Identical requests in flight are merged. Outbound calls are rate-limited with a token bucket that honours `Retry-After`. Inbound API calls are rate-limited per IP. Responses are validated with Zod. Live mode **never** falls back to fake data. |
| **Themes and PWA** | Dark (default), light and system themes; installable PWA. The service worker never caches market data. |
| **Settings** | Theme, quote currency (12 options, including BTC and ETH), time zone, chart defaults, reset. |
| **Status page** | `/status` shows provider, plan, capabilities and upstream health. |

The other navigation sections (AI Analyst, Scanner, Portfolio, Alerts, and so on) open honest "Planned · Phase N" pages. They contain no placeholder numbers and no controls that do nothing.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: add a CoinGecko Demo key
npm run dev                    # http://localhost:3000 — live CoinGecko data
```

To exercise the UI without network access or keys:

```bash
npm run dev:demo               # DATA_MODE=demo — synthetic, FICTIONAL assets, clearly bannered
```

### Recommended: a free CoinGecko Demo key

The keyless public API has strict, variable rate limits. A free Demo key (30 calls/min) makes the app far more reliable:

```env
COINGECKO_PLAN=demo
COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxx
COINGECKO_RATE_LIMIT_PER_MIN=25
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run dev:demo` | Dev server (live / demo data) |
| `npm run build && npm start` | Production build and server |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | Playwright smoke tests (build first; runs in demo mode) |
| `npm run db:generate` / `npm run db:migrate` | Prisma client / apply migrations (needed from Phase 2) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, data flow, provider abstraction, caching.
- [Data sources](docs/DATA_SOURCES.md): external dependencies, limits, licensing and attribution.
- [Deployment](docs/DEPLOYMENT.md): hosting topology, environments, secrets.
- [Roadmap and limitations](docs/ROADMAP.md): phases, what is done, known gaps.

## Disclaimer

CryptoScope AI provides market information and descriptive analytics. It does not provide investment, financial, legal or tax advice. Market data can be delayed, incomplete or wrong.
