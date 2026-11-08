# Architecture

## Layers

```
 Browser (React client components)
   │  polls /api/* with usePolled (pauses in hidden tabs, keeps the last good data and exposes the error)
   ▼
 Next.js route handlers  src/app/api/*            ← input validation (Zod), per-IP rate limit, error mapping
   ▼
 MarketService           src/lib/market/service.ts ← cache keys, TTLs, provenance metadata (DataMeta)
   ▼
 SwrCache                src/lib/cache/swr-cache.ts ← stale-while-error, merged in-flight requests, LRU-ish eviction
   ▼
 MarketDataProvider      src/lib/market/types.ts   ← provider-agnostic interface
   ├─ CoinGeckoProvider  src/lib/providers/coingecko  (HTTP + token bucket + Zod schemas + normalization)
   └─ DemoProvider       src/lib/providers/demo       (synthetic, fictional assets — opt-in only)

 Pure computation (no I/O)
   src/lib/indicators    SMA, EMA, RSI (Wilder), MACD, Bollinger, ATR
   src/lib/market/derive breadth, contributors, excluding-BTC totals
   src/components/market/summary.ts  template-based factual summary
```

Ingestion, calculation, explanation and rendering are kept separate:

- **Providers** fetch data, validate it and normalize it. Nothing else knows CoinGecko's response shapes.
- **Indicators and derive** are pure functions with unit tests. Future AI features will *explain* their outputs and never compute numbers themselves.
- **UI** renders only normalized domain objects plus `DataMeta`.

## Key decisions

| Decision | Why |
| --- | --- |
| Asset identity = provider id (`bitcoin`), never the ticker symbol | Different assets share tickers; the test fixtures include a fake "BTC". |
| `null` for missing data end to end, rendered as "—" | Avoids fake zeros. |
| `DataMeta` on every response (`source`, `fetchedAt`, `providerUpdatedAt`, `stale`, `staleReason`, `refreshIntervalSec`, `realtime`, `mode`, `priceKind`) | Lets the UI state freshness and provenance honestly. |
| Stale-while-error cache with a `maxStale` limit | Provider outages degrade to clearly labelled stale data, then to an explicit error. Very old data is never shown. |
| No fallback from live to demo | Synthetic data must never pose as market data. |
| Demo mode uses fictional names ("Aurora Demo") | Screenshots from demo mode can't be mistaken for real prices. |
| Volume series labelled `rolling-24h` | CoinGecko's `market_chart` volume is a rolling 24h aggregate, not volume traded within each candle. |
| Candle timestamps labelled as **close** time | That is CoinGecko's OHLC convention. |
| Indicator periods counted in candles and labelled that way | SMA 20 on 4h candles is not a 20-day SMA. |
| Third-party text (descriptions) stripped of HTML and rendered as text | Prevents XSS. It is also treated as untrusted input for future AI prompts (defence against prompt injection). |

## Caching and rate limits

| Resource | Server TTL | Max stale | Client poll |
| --- | --- | --- | --- |
| Markets, global, coin | 60 s | 30 min | 60 s |
| Chart (OHLC + volume) | 5 min | 6 h | 5 min |
| Search | 10 min | 24 h | on input (300 ms debounce) |

The overview requests `/api/markets?perPage=250`, which uses the same cache key as the breadth sample in `/api/global`. As a result, the dashboard costs about 3 upstream calls per minute however many browsers are open.

The cache is in-process (a singleton on `globalThis`). This works for a single long-running Node server. For several instances, implement the same `get(key, opts, loader)` contract on Redis (see Phase 2 in the roadmap).

## Security

- Provider keys are read only on the server (`src/lib/config.ts` imports `server-only`). Nothing is exposed to the client.
- All route inputs are validated with Zod (currency allowlist, id regex, bounded paging, search character class).
- Per-IP rate limiting on `/api/*`. Errors are mapped to generic messages, so no internal details leak.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`.
- External links use `rel="noopener noreferrer nofollow"`, and URLs are restricted to http(s).
- The app never requests wallet seed phrases or private keys.

## Database

`prisma/schema.prisma` defines the persistent model for Phases 2–5: users and preferences, networks, assets and contracts, venues and pairs, quotes, candles, indicator and regime snapshots, portfolios and transactions, watchlists, alerts and notifications, news, AI reports, data-source status, background jobs and the audit log. All money fields are `Decimal` and all timestamps are `timestamptz`. The initial migration is in `prisma/migrations/`. Phase 1 does not need a database.

## Mobile apps

The browser talks only to `/api/*` JSON endpoints, which return normalized domain types. Native iOS and Android clients can use the same endpoints (add auth headers in Phase 4).
