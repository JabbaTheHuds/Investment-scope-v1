-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VenueKind" AS ENUM ('CEX', 'DEX', 'AGGREGATE');

-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('AGGREGATED', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "CandleInterval" AS ENUM ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1');

-- CreateEnum
CREATE TYPE "CostBasisMethod" AS ENUM ('FIFO', 'LIFO', 'HIFO', 'AVERAGE');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'INCOME');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TRIGGERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    "displayName" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "timeZone" TEXT,
    "chartPrefs" JSONB NOT NULL DEFAULT '{}',
    "dashboard" JSONB NOT NULL DEFAULT '[]',
    "quietHours" JSONB,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chainId" INTEGER,
    "isEvm" BOOLEAN NOT NULL DEFAULT false,
    "providerIds" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coingeckoId" TEXT,
    "categories" TEXT[],
    "imageUrl" TEXT,
    "isStablecoin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetContract" (
    "assetId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "decimals" INTEGER,

    CONSTRAINT "AssetContract_pkey" PRIMARY KEY ("networkId","address")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VenueKind" NOT NULL,
    "trustScore" TEXT,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPair" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "baseAssetId" TEXT NOT NULL,
    "quoteAssetId" TEXT,
    "quoteSymbol" TEXT NOT NULL,
    "venueSymbol" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "assetId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priceKind" "PriceKind" NOT NULL,
    "venueId" TEXT,
    "price" DECIMAL(38,18) NOT NULL,
    "marketCap" DECIMAL(38,2),
    "fdv" DECIMAL(38,2),
    "volume24h" DECIMAL(38,2),
    "change1hPct" DECIMAL(18,8),
    "change24hPct" DECIMAL(18,8),
    "change7dPct" DECIMAL(18,8),
    "circulating" DECIMAL(38,8),
    "totalSupply" DECIMAL(38,8),
    "maxSupply" DECIMAL(38,8),
    "providerTime" TIMESTAMPTZ,
    "fetchedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("assetId","currency","source")
);

-- CreateTable
CREATE TABLE "Candle" (
    "assetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "venueId" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL,
    "interval" "CandleInterval" NOT NULL,
    "openTime" TIMESTAMPTZ NOT NULL,
    "open" DECIMAL(38,18) NOT NULL,
    "high" DECIMAL(38,18) NOT NULL,
    "low" DECIMAL(38,18) NOT NULL,
    "close" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,8),
    "volumeKind" TEXT NOT NULL DEFAULT 'per-candle',
    "ingestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("assetId","source","venueId","currency","interval","openTime")
);

-- CreateTable
CREATE TABLE "IndicatorSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "interval" "CandleInterval" NOT NULL,
    "asOf" TIMESTAMPTZ NOT NULL,
    "values" JSONB NOT NULL,
    "candleCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRegimeSnapshot" (
    "id" TEXT NOT NULL,
    "asOf" TIMESTAMPTZ NOT NULL,
    "regime" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "methodology" TEXT NOT NULL,
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketRegimeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'usd',
    "costBasis" "CostBasisMethod" NOT NULL DEFAULT 'FIFO',
    "benchmark" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioTransaction" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(38,18) NOT NULL,
    "unitPrice" DECIMAL(38,18),
    "priceCurrency" TEXT NOT NULL DEFAULT 'usd',
    "feeAmount" DECIMAL(38,18),
    "feeAssetId" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "note" TEXT,
    "importBatch" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "watchlistId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("watchlistId","assetId")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "cooldownSec" INTEGER NOT NULL DEFAULT 3600,
    "lastEvaluatedAt" TIMESTAMPTZ,
    "lastTriggeredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "triggerValue" JSONB,
    "dedupeKey" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ NOT NULL,
    "summary" TEXT,
    "significance" TEXT,
    "classifiedBy" TEXT,
    "ingestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsAssetLink" (
    "articleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "NewsAssetLink_pkey" PRIMARY KEY ("articleId","assetId")
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "assetId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dataAsOf" TIMESTAMPTZ NOT NULL,
    "inputs" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSourceStatus" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMPTZ,
    "lastFailureAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DataSourceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_coingeckoId_key" ON "Asset"("coingeckoId");

-- CreateIndex
CREATE INDEX "Asset_symbol_idx" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "AssetContract_assetId_idx" ON "AssetContract"("assetId");

-- CreateIndex
CREATE INDEX "MarketPair_baseAssetId_idx" ON "MarketPair"("baseAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPair_venueId_venueSymbol_key" ON "MarketPair"("venueId", "venueSymbol");

-- CreateIndex
CREATE INDEX "Candle_assetId_interval_openTime_idx" ON "Candle"("assetId", "interval", "openTime" DESC);

-- CreateIndex
CREATE INDEX "IndicatorSnapshot_interval_asOf_idx" ON "IndicatorSnapshot"("interval", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorSnapshot_assetId_interval_asOf_key" ON "IndicatorSnapshot"("assetId", "interval", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "MarketRegimeSnapshot_asOf_key" ON "MarketRegimeSnapshot"("asOf");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "PortfolioTransaction_portfolioId_occurredAt_idx" ON "PortfolioTransaction"("portfolioId", "occurredAt");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "AlertRule_status_assetId_idx" ON "AlertRule"("status", "assetId");

-- CreateIndex
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "AiReport_assetId_createdAt_idx" ON "AiReport"("assetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BackgroundJob_queue_status_runAt_idx" ON "BackgroundJob"("queue", "status", "runAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetContract" ADD CONSTRAINT "AssetContract_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetContract" ADD CONSTRAINT "AssetContract_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPair" ADD CONSTRAINT "MarketPair_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPair" ADD CONSTRAINT "MarketPair_baseAssetId_fkey" FOREIGN KEY ("baseAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPair" ADD CONSTRAINT "MarketPair_quoteAssetId_fkey" FOREIGN KEY ("quoteAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorSnapshot" ADD CONSTRAINT "IndicatorSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioTransaction" ADD CONSTRAINT "PortfolioTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAssetLink" ADD CONSTRAINT "NewsAssetLink_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAssetLink" ADD CONSTRAINT "NewsAssetLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

