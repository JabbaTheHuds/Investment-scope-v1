# Roadmap, status and limitations

## Phase 1: Working foundation ✅

Done: application shell and navigation, dark, light and system themes, responsive layout, search (name, ticker, contract), market listings, global stats, breadth and contributor analysis, coin detail pages, interactive charts with overlays, the provider abstraction with the CoinGecko integration, freshness and stale labelling, error states and boundaries, PWA shell, settings, status page, Prisma schema and migration, unit and E2E tests.

### Verification
- `npm run typecheck`: passes (strict, `noUncheckedIndexedAccess`).
- `npm test`: 56 unit and integration tests. Covered: indicators (checked against the Wilder RSI reference set), CoinGecko normalization against fixtures shaped like the documented responses, HTTP failure handling (429 / Retry-After, 404, 5xx, network errors, invalid payloads), contract search, the cache's stale-while-error behaviour and request merging, rate limiters, breadth and contributor math, the summary logic, formatting, and determinism and labelling of the demo provider.
- `npm run test:e2e`: 6 Playwright smoke tests in demo mode. Covered: demo banner, overview, keyboard search into a coin page with a rendered chart, table sorting, favourites persisting after reload, planned pages, 404s, API input validation.
- Manual check of an outage: with CoinGecko unreachable, every panel shows an explicit "Data unavailable" or "Unavailable — no data received" state, and no placeholder numbers appear.

### Known limitations (Phase 1)
- **Not verified against the live CoinGecko API from the build environment**, because outbound access to CoinGecko was blocked there. The adapter is tested against fixtures shaped like the documented responses. Run `npm run dev` with network access to confirm.
- Prices are polled aggregates (about 60 s), **not** a real-time stream. Real-time exchange data arrives with the Phase 2 WebSocket worker.
- The cache and rate limiters are in-process. Running several instances needs Redis.
- Global stats have no historical timeframe chart yet. CoinGecko's global market-cap history is paid-only; a self-built history needs the Phase 2 ingestion.
- Markets sorting applies to the current page of 100. Sorting across the whole market needs the indexed database (Phase 2).
- Favourites, dashboard layout and chart preferences live in this browser's `localStorage` until accounts arrive (Phase 4).
- Charts rebuild whenever the data refreshes (every 5 min). Incremental `series.update()` arrives with streaming data.
- Volume/market cap and the 24h range use provider snapshot values; they are not recomputed from trades.

## Phase 2: Advanced market analytics
- Worker service: scheduled ingestion into Postgres (quotes, candles), Coinbase WebSocket for real-time exchange prices, Redis cache and queues with retries and a dead-letter queue.
- Indicator snapshots for all tracked assets: ADX, Stochastic RSI, ROC, ATR, OBV, VWAP (on real per-candle volume), realized volatility, abnormal-volume detection.
- Market scanner on indexed snapshots, with presets and an explanation of why each asset qualifies.
- Market regime classification and a risk dashboard with a published, versioned methodology. Market strength, risk and data quality are scored separately.
- Asset comparison overlays and global history charts.

## Phase 3: AI intelligence
- Claude-based analyst using tool calls over validated data objects, with outputs checked against a schema in a 10-section format. Each answer shows timestamps, sources, missing data and uncertainty.
- Prompt-injection hardening: third-party text is passed only as quoted, labelled data.
- News ingestion (licensed source), significance classification, economic calendar, daily briefing, PDF export.

## Phase 4: Personalized features
- Authentication (reputable provider, MFA, recovery), watchlists synced to the account, transaction-based portfolios (FIFO/LIFO/HIFO/average cost basis, CSV import and export, benchmarks, stress tests), alerts with cooldowns, deduplication, quiet hours and delivery tracking, data export and account deletion.

## Phase 5: Advanced intelligence
- On-chain analytics, anomaly detection, liquidity analysis, look-ahead-safe backtesting with fees and slippage, paper trading, email and push notifications.
