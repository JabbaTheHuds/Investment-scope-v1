"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { IndicatorSnapshot } from "@/components/coin/IndicatorSnapshot";
import { PriceChart } from "@/components/coin/PriceChart";
import { usePrefs } from "@/components/shell/PreferencesProvider";
import { Freshness } from "@/components/ui/Freshness";
import { AssetIcon, Badge, Card, CardHeader, Change, cx, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import { formatAgo, formatCompact, formatCompactMoney, formatDate, formatPct, formatPrice } from "@/lib/format";
import type { ChartResponse } from "@/lib/market/api-types";
import type { CoinDetail, Envelope } from "@/lib/market/types";

export default function CoinPage() {
  const { id } = useParams<{ id: string }>();
  const { currency, favorites, toggleFavorite, timeZone } = usePrefs();
  const coin = usePolled<Envelope<CoinDetail>>(`/api/coins/${encodeURIComponent(id)}?currency=${currency}`, 60_000);
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const onCandles = useCallback((c: ChartResponse | null) => setChart(c), []);
  const c = coin.data?.data;
  const fav = favorites.includes(id);

  if (coin.error?.status === 404) {
    return <ErrorState title="Asset not found" message={`No asset with id “${id}” exists at the data provider. Try the search bar.`} />;
  }

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {c ? <AssetIcon src={c.image} symbol={c.symbol} size={40} /> : <Skeleton className="h-10 w-10 rounded-full" />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{c?.name ?? id}</h1>
              {c && <span className="text-sm text-muted">{c.symbol}</span>}
              {c?.rank != null && <Badge>Rank #{c.rank}</Badge>}
              <button onClick={() => toggleFavorite(id)} aria-pressed={fav} aria-label={fav ? "Remove from favourites" : "Add to favourites"} className={cx("text-lg leading-none", fav ? "text-warn" : "text-muted hover:text-fg")}>{fav ? "★" : "☆"}</button>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="tabular text-2xl font-semibold">{c ? formatPrice(c.price, currency) : <Skeleton className="h-7 w-32" />}</span>
              {c && <Change value={c.change24h} className="text-sm" />}
              {c && <span className="text-xs text-muted">24h · aggregated price</span>}
            </div>
          </div>
        </div>
        <Freshness meta={coin.data?.meta} error={coin.error} />
      </div>

      {coin.error && !c && <ErrorState message={coin.error.message} onRetry={coin.refetch} />}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <PriceChart coinId={id} onCandles={onCandles} />
          {c && <Performance c={c} />}
          <IndicatorSnapshot chart={chart} />
        </div>
        <div className="space-y-4">
          {c ? <KeyStats c={c} /> : <Card className="p-4"><Skeleton className="h-64 w-full" /></Card>}
          {c && <About c={c} />}
        </div>
      </div>

      {c && <Venues c={c} timeZone={timeZone} />}
    </div>
  );
}

function Performance({ c }: { c: CoinDetail }) {
  const items: [string, number | null][] = [["1h", c.change1h], ["24h", c.change24h], ["7d", c.change7d], ["14d", c.change14d], ["30d", c.change30d], ["60d", c.change60d], ["200d", c.change200d], ["1y", c.change1y]];
  return (
    <Card>
      <CardHeader title="Price performance" subtitle="Percentage change in the selected currency" />
      <dl className="grid grid-cols-4 gap-px bg-line/60 sm:grid-cols-8">
        {items.map(([k, v]) => (
          <div key={k} className="bg-panel px-3 py-2.5 text-center">
            <dt className="text-[11px] uppercase tracking-wider text-muted">{k}</dt>
            <dd className="mt-1 text-sm font-medium"><Change value={v} /></dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function KeyStats({ c }: { c: CoinDetail }) {
  const { currency, timeZone } = usePrefs();
  const volMcap = c.volume24h != null && c.marketCap ? (c.volume24h / c.marketCap) * 100 : null;
  const supplyPct = c.circulatingSupply != null && c.maxSupply ? (c.circulatingSupply / c.maxSupply) * 100 : null;
  const rangePos = c.price != null && c.high24h != null && c.low24h != null && c.high24h > c.low24h ? ((c.price - c.low24h) / (c.high24h - c.low24h)) * 100 : null;
  return (
    <Card>
      <CardHeader title="Market statistics" />
      <div className="space-y-5 p-4">
        {rangePos != null && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-muted"><span>24h low</span><span>24h range</span><span>24h high</span></div>
            <div className="relative h-1.5 rounded-full bg-panel-2" role="img" aria-label={`Price is ${rangePos.toFixed(0)}% of the way from the 24h low to the 24h high`}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-down via-warn to-up" style={{ width: `${Math.min(100, Math.max(0, rangePos))}%` }} />
            </div>
            <div className="tabular mt-1 flex justify-between text-xs"><span>{formatPrice(c.low24h, currency)}</span><span>{formatPrice(c.high24h, currency)}</span></div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Market cap" value={formatCompactMoney(c.marketCap, currency)} />
          <Stat label="Fully diluted val." value={formatCompactMoney(c.fdv, currency)} hint="Price × maximum (or total) supply." />
          <Stat label="Volume 24h" value={formatCompactMoney(c.volume24h, currency)} />
          <Stat label="Vol / MCap" value={volMcap == null ? "—" : `${volMcap.toFixed(2)}%`} hint="24h volume ÷ market cap. Higher means more turnover relative to size." />
          <Stat label="Circulating" value={c.circulatingSupply == null ? "—" : formatCompact(c.circulatingSupply)} sub={supplyPct != null ? <span className="text-muted">{supplyPct.toFixed(1)}% of max</span> : null} />
          <Stat label="Total supply" value={c.totalSupply == null ? "—" : formatCompact(c.totalSupply)} />
          <Stat label="Max supply" value={c.maxSupply == null ? "∞ / not set" : formatCompact(c.maxSupply)} />
          <Stat label="Last provider update" value={<span className="text-sm">{formatAgo(c.lastUpdated)}</span>} />
          <Stat label="All-time high" value={formatPrice(c.ath, currency)} sub={<span className="text-muted"><Change value={c.athChangePct} /> from ATH · {formatDate(c.athDate, timeZone || undefined)}</span>} />
          <Stat label="All-time low" value={formatPrice(c.atl, currency)} sub={<span className="text-muted">{formatPct(c.atlChangePct)} from ATL · {formatDate(c.atlDate, timeZone || undefined)}</span>} />
        </dl>
      </div>
    </Card>
  );
}

function About({ c }: { c: CoinDetail }) {
  const [expanded, setExpanded] = useState(false);
  const desc = c.description;
  return (
    <Card>
      <CardHeader title={`About ${c.name}`} subtitle="Third-party description from the data provider" />
      <div className="space-y-3 p-4 text-sm">
        {desc ? (
          <p className={cx("whitespace-pre-line leading-relaxed text-muted", !expanded && "line-clamp-6")}>{desc}</p>
        ) : (
          <p className="text-muted">No description provided.</p>
        )}
        {desc.length > 400 && <button onClick={() => setExpanded((e) => !e)} className="text-xs text-accent hover:underline">{expanded ? "Show less" : "Show more"}</button>}
        {c.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">{c.categories.slice(0, 10).map((x) => <Badge key={x}>{x}</Badge>)}</div>
        )}
        <dl className="space-y-1.5 text-xs">
          {c.hashingAlgorithm && <div className="flex justify-between gap-2"><dt className="text-muted">Hashing algorithm</dt><dd>{c.hashingAlgorithm}</dd></div>}
          {c.genesisDate && <div className="flex justify-between gap-2"><dt className="text-muted">Genesis</dt><dd>{formatDate(c.genesisDate)}</dd></div>}
        </dl>
        {c.platforms.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">Contracts</p>
            <ul className="space-y-1">
              {c.platforms.slice(0, 8).map((p) => (
                <li key={p.chain} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-muted">{p.chain}</span>
                  <code className="truncate font-mono">{p.address}</code>
                  <button onClick={() => navigator.clipboard?.writeText(p.address)} className="shrink-0 rounded border border-line px-1.5 text-[10px] text-muted hover:text-fg" aria-label={`Copy ${p.chain} contract address`}>Copy</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs">
          {c.homepage && <a href={c.homepage} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">Website ↗</a>}
          {c.explorers.slice(0, 3).map((e) => (
            <a key={e} href={e} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">{new URL(e).hostname} ↗</a>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Venues({ c, timeZone }: { c: CoinDetail; timeZone: string }) {
  if (c.tickers.length === 0) {
    return (
      <Card>
        <CardHeader title="Exchange markets" />
        <p className="p-4 text-sm text-muted">No exchange market data available for this asset from the current provider.</p>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Exchange markets" subtitle="Venue-specific prices (not aggregated) — top pairs by USD volume. Anomalous tickers are excluded." />
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Exchange markets for {c.name}</caption>
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-2 font-medium">Exchange</th>
              <th scope="col" className="px-3 py-2 font-medium">Pair</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Last price</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Volume (USD)</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Bid–ask spread reported by the provider">Spread</th>
              <th scope="col" className="px-3 py-2 font-medium" title="Provider's liquidity/trust classification">Trust</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Last trade</th>
            </tr>
          </thead>
          <tbody>
            {c.tickers.map((t, i) => (
              <tr key={`${t.exchangeId}-${t.base}-${t.target}-${i}`} className="border-b border-line/60">
                <td className="px-4 py-2">{t.tradeUrl ? <a href={t.tradeUrl} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent">{t.exchange} ↗</a> : t.exchange}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.base.length > 12 ? t.base.slice(0, 10) + "…" : t.base}/{t.target.length > 12 ? t.target.slice(0, 10) + "…" : t.target}</td>
                <td className="tabular px-3 py-2 text-right">{t.last == null ? "—" : `${t.last.toLocaleString(undefined, { maximumSignificantDigits: 8 })} ${t.target.length <= 6 ? t.target : ""}`}</td>
                <td className="tabular px-3 py-2 text-right">{formatCompactMoney(t.volumeUsd, "usd")}</td>
                <td className="tabular px-3 py-2 text-right">{t.spreadPct == null ? "—" : `${t.spreadPct.toFixed(2)}%`}</td>
                <td className="px-3 py-2">{t.trustScore ? <Badge tone={t.trustScore === "green" ? "up" : t.trustScore === "red" ? "down" : "warn"}>{t.trustScore}</Badge> : "—"}</td>
                <td className={cx("px-4 py-2 text-right text-xs", t.isStale ? "text-down" : "text-muted")}>{t.isStale ? "stale · " : ""}{formatAgo(t.lastTradedAt)}<span className="sr-only"> ({formatDate(t.lastTradedAt, timeZone || undefined, true)})</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
