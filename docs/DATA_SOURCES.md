# External data dependencies

> Verify current terms before production use. Provider plans, limits and licensing change. The notes below reflect the integration as built. Confirm each against the provider's current documentation and terms before going commercial.

## Integrated (Phase 1)

### CoinGecko API v3: primary market data
- **Used for:** listings and prices (`/coins/markets`), global stats (`/global`), stablecoin category cap (`/coins/categories`), coin detail plus exchange tickers (`/coins/{id}`), OHLC (`/coins/{id}/ohlc`), volume history (`/coins/{id}/market_chart`), search (`/search`), contract lookup (`/coins/{platform}/contract/{address}`).
- **Plans:** `public` (no key, strict and variable limits), `demo` (free key, about 30 calls/min, header `x-cg-demo-api-key`, host `api.coingecko.com`), `pro` (paid, header `x-cg-pro-api-key`, host `pro-api.coingecko.com`).
- **Known constraints, reflected in the UI:**
  - Prices are **volume-weighted aggregates** across venues, cached by CoinGecko for about 60 s. They are *not* real-time. The UI says "Aggregated · refreshes ~1 min".
  - Public and Demo plans are limited to **365 days** of history. "Max" is disabled with an explanation.
  - OHLC granularity is set automatically: 1–2 days → 30 min, 3–30 days → 4 h, 31+ days → 4 days. Timestamps mark the candle close.
  - `market_chart` volume is a **rolling 24h** aggregate, not volume per candle.
  - The historical total-market-cap chart (`/global/market_cap_chart`) is paid-only and is not used yet.
- **Attribution:** "Data provided by CoinGecko" with a link, shown in the footer. Check CoinGecko's attribution and redistribution terms for your plan.

### TradingView Lightweight Charts (v5): rendering only
- Apache-2.0 licence. It **requires attribution to TradingView**. The built-in attribution logo is left enabled (`attributionLogo: true`).

## Planned integrations

| Provider | Phase | Purpose | Notes |
| --- | --- | --- | --- |
| Coinbase Advanced Trade / Exchange market-data WebSocket | 2 | Real-time trades and ticker for supported pairs | Needs a dedicated long-running worker. Serverless hosting can't hold WebSockets. Label as an **exchange** price, kept separate from aggregates. |
| DefiLlama (TVL, stablecoins) | 2 | DeFi and chain metrics, stablecoin supply | Free API; check attribution terms. |
| Alternative.me Fear & Greed | 2 | Supplementary sentiment | Attribution required. Show as a third-party index, not a forecast. |
| Licensed news API | 3 | News intelligence | Must permit storage and summarization. Store metadata and short original summaries only, never full articles. |
| Economic calendar source | 3 | FOMC, CPI, NFP schedule | Use an official or licensed source. |
| Anthropic Claude API | 3 | AI analyst | Server-side only. Gets structured, validated data through tool calls and never performs critical arithmetic. Prompt versions are logged in `AiReport`. |

## Data-integrity rules

1. Asset identity is the provider id. Contract addresses are kept per chain (`AssetContract`). Ticker symbols are never treated as unique.
2. Aggregated prices and exchange-specific prices are separate types (`PriceKind`) and are labelled separately in the UI.
3. Every response records its source and timestamps. Data is marked stale when a refresh fails or it exceeds 3× its refresh interval.
4. Anomalous exchange tickers (flagged by the provider) are excluded. Stale tickers are marked.
5. Malformed, duplicate or impossible candles (high < low, negative or missing values) are dropped during normalization.
