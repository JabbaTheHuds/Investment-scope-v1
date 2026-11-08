# Deployment

## Phase 1 topology (single service)

Phase 1 is one Node.js service (Next.js) with an in-process cache. **Run it as a long-lived server** (`npm run build && npm start`), for example on Fly.io, Render, Railway, a container platform or a VM. Long-lived means the cache and rate limiter persist between requests.

Serverless hosting (for example Vercel) also works for Phase 1, with two caveats. Each cold instance has its own empty cache, so upstream traffic and rate-limit pressure rise. And from Phase 2 onward, WebSocket ingestion and scheduled workers **cannot** run in serverless functions.

## Target topology (Phase 2+)

```
           ┌──────────────┐        ┌─────────────────────┐
 users ──► │ Next.js web  │ ─────► │ Managed PostgreSQL  │
           │ (frontend +  │ ◄───┐  └─────────────────────┘
           │  API routes) │     │  ┌─────────────────────┐
           └──────────────┘     ├─ │ Managed Redis       │ cache, rate limits, job queues
                                │  └─────────────────────┘
           ┌──────────────┐     │
           │ Worker(s)    │ ────┘  WebSocket ingestion, scheduled indicator/regime/scanner
           │ long-running │        jobs, alert evaluation, retry + dead-letter queues
           └──────────────┘
```

## Environments

Use separate **development**, **staging** and **production** environments, each with its own database, Redis and provider keys. Run `npm run db:migrate` (`prisma migrate deploy`) as a release step.

## Secrets

Store `COINGECKO_API_KEY`, `DATABASE_URL`, `REDIS_URL` and `ANTHROPIC_API_KEY` in the host's secret manager. Never commit `.env*` files; they are git-ignored. None of these variables use the `NEXT_PUBLIC_` prefix, so none can reach the browser.

## Checklist

- [ ] `DATA_MODE=live`, with `COINGECKO_PLAN` and the key set
- [ ] `COINGECKO_RATE_LIMIT_PER_MIN` below the plan limit
- [ ] HTTPS enforced at the edge
- [ ] Health check on `GET /api/status`
- [ ] Log shipping and alerting on `/api/status` → `sources[].consecutiveFailures`
- [ ] Dependency scanning (`npm audit`, Dependabot or Renovate)
