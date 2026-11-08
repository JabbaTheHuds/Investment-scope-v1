"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketTable } from "@/components/market/MarketTable";
import { buildMarketSummary } from "@/components/market/summary";
import { usePrefs, type WidgetId } from "@/components/shell/PreferencesProvider";
import { Freshness } from "@/components/ui/Freshness";
import { AssetIcon, Badge, Card, CardHeader, Change, cx, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import { formatCompactMoney, formatNumber, formatPct, formatPrice } from "@/lib/format";
import type { GlobalResponse } from "@/lib/market/api-types";
import type { Envelope, MarketRow } from "@/lib/market/types";

const WIDGET_LABEL: Record<WidgetId, string> = {
  stats: "Global statistics",
  summary: "Market summary & breadth",
  movers: "Top movers",
  favorites: "Favourites",
  table: "Top assets",
};

export default function OverviewPage() {
  const { currency, dashboard, set } = usePrefs();
  const [customizing, setCustomizing] = useState(false);
  const global = usePolled<GlobalResponse>(`/api/global?currency=${currency}`, 60_000);
  // Same cache key as the breadth sample on the server → no extra provider request.
  const markets = usePolled<Envelope<MarketRow[]>>(`/api/markets?currency=${currency}&perPage=250&page=1`, 60_000);

  const move = (i: number, d: -1 | 1) => {
    const next = [...dashboard];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set("dashboard", next);
  };

  const widgets: Record<WidgetId, React.ReactNode> = {
    stats: <GlobalStatsWidget g={global} />,
    summary: <SummaryWidget g={global} />,
    movers: <MoversWidget m={markets} />,
    favorites: <FavoritesWidget m={markets} />,
    table: (
      <Card>
        <CardHeader
          title="Top assets by market cap"
          subtitle="Aggregated prices across venues"
          right={<><Freshness meta={markets.data?.meta} error={markets.error} compact /><Link href="/markets" className="text-xs text-accent hover:underline">All markets →</Link></>}
        />
        {markets.error && !markets.data ? (
          <div className="p-4"><ErrorState message={markets.error.message} onRetry={markets.refetch} /></div>
        ) : (
          <MarketTable rows={markets.data?.data.slice(0, 25) ?? null} loading={markets.loading} compact caption="Top 25 assets by market capitalization" />
        )}
      </Card>
    ),
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Market Overview</h1>
          <Freshness meta={global.data?.meta} error={global.error} className="mt-1" />
        </div>
        <button onClick={() => setCustomizing((c) => !c)} aria-pressed={customizing} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-panel-2">
          {customizing ? "Done" : "Customize dashboard"}
        </button>
      </div>

      {customizing && (
        <Card className="p-3">
          <p className="mb-2 text-xs text-muted">Show, hide and reorder widgets. Saved in this browser.</p>
          <ul className="space-y-1">
            {dashboard.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 rounded-md bg-panel-2 px-2 py-1.5 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <input type="checkbox" checked={w.visible} onChange={(e) => set("dashboard", dashboard.map((x) => (x.id === w.id ? { ...x, visible: e.target.checked } : x)))} />
                  {WIDGET_LABEL[w.id]}
                </label>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${WIDGET_LABEL[w.id]} up`} className="rounded border border-line px-2 disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === dashboard.length - 1} aria-label={`Move ${WIDGET_LABEL[w.id]} down`} className="rounded border border-line px-2 disabled:opacity-30">↓</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dashboard.filter((w) => w.visible).map((w) => (
        <div key={w.id}>{widgets[w.id]}</div>
      ))}
    </div>
  );
}

type GlobalPoll = ReturnType<typeof usePolled<GlobalResponse>>;
type MarketsPoll = ReturnType<typeof usePolled<Envelope<MarketRow[]>>>;

function GlobalStatsWidget({ g }: { g: GlobalPoll }) {
  const { currency } = usePrefs();
  if (g.error && !g.data) return <ErrorState message={g.error.message} onRetry={g.refetch} />;
  const d = g.data?.data;
  const v = (x: React.ReactNode) => (d ? x : <Skeleton className="h-6 w-24" />);
  return (
    <Card className="p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
        <Stat label="Total market cap" value={v(formatCompactMoney(d?.totalMarketCap, currency))} sub={d && <Change value={d.marketCapChange24hPct} />} hint="Sum of tracked assets' market caps. 24h change is on a USD basis." />
        <Stat label="24h volume" value={v(formatCompactMoney(d?.totalVolume24h, currency))} hint="Aggregated reported trading volume over the last 24 hours." />
        <Stat label="BTC dominance" value={v(formatPct(d?.btcDominance).replace("+", ""))} hint="Bitcoin market cap ÷ total market cap." />
        <Stat label="ETH dominance" value={v(formatPct(d?.ethDominance).replace("+", ""))} />
        <Stat label="Mkt cap ex-BTC" value={v(formatCompactMoney(d?.totalExBtc, currency))} hint="Derived: total × (1 − BTC dominance)." />
        <Stat label="Ex-BTC & ETH" value={v(formatCompactMoney(d?.totalExBtcEth, currency))} hint="Derived: total × (1 − BTC dominance − ETH dominance)." />
        <Stat label="Stablecoin cap" value={v(formatCompactMoney(d?.stablecoinMarketCap, currency))} hint="Market cap of the provider's 'Stablecoins' category." />
        <Stat label="Tracked assets" value={v(formatNumber(d?.activeCryptocurrencies, { maximumFractionDigits: 0 }))} sub={d?.markets != null ? <span className="text-muted">{formatNumber(d.markets, { maximumFractionDigits: 0 })} markets</span> : null} />
      </dl>
    </Card>
  );
}

function SummaryWidget({ g }: { g: GlobalPoll }) {
  const { currency } = usePrefs();
  const lines = useMemo(() => (g.data ? buildMarketSummary(g.data, currency) : []), [g.data, currency]);
  const a = g.data?.analysis;
  const b = a?.breadth;
  const known = b ? b.advancers + b.decliners + b.unchanged : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
      <Card className="lg:col-span-2">
        <CardHeader title="What changed in the last 24 hours" subtitle="Automated factual summary computed from the data shown — no AI, no inferred causes" right={<Badge tone="neutral">Computed</Badge>} />
        <div className="space-y-2 p-4 text-sm leading-relaxed">
          {!g.data && !g.error && <><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></>}
          {g.error && !g.data && <p className="text-muted">Summary unavailable: {g.error.message}</p>}
          {lines.map((l, i) => <p key={i}>{l}</p>)}
          {g.data?.analysisError && <p className="text-xs text-warn">Breadth analysis unavailable: {g.data.analysisError}</p>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Market breadth (24h)" subtitle={a?.sampleDescription ?? "Top assets by market cap"} />
        <div className="space-y-4 p-4">
          {b && known > 0 ? (
            <>
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-panel-2" role="img" aria-label={`${b.advancers} advancing, ${b.unchanged} unchanged, ${b.decliners} declining`}>
                  <div className="bg-up" style={{ width: `${(b.advancers / known) * 100}%` }} />
                  <div className="bg-muted/40" style={{ width: `${(b.unchanged / known) * 100}%` }} />
                  <div className="bg-down" style={{ width: `${(b.decliners / known) * 100}%` }} />
                </div>
                <div className="tabular mt-2 flex justify-between text-xs">
                  <span className="text-up">▲ {b.advancers} up</span>
                  <span className="text-muted">{b.unchanged} flat</span>
                  <span className="text-down">▼ {b.decliners} down</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Median 24h" value={<Change value={b.median24h} />} />
                <Stat label="Beat BTC" value={b.pctOutperformingBtc == null ? "—" : `${b.pctOutperformingBtc.toFixed(0)}%`} hint="Share of the sample with a higher 24h return than Bitcoin." />
              </dl>
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Largest market-cap contributors</p>
                <ul className="space-y-1 text-sm">
                  {a!.contributors.contributors.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <Link href={`/coins/${c.id}`} className="truncate hover:text-accent">{c.name} <span className="text-xs text-muted">{c.symbol}</span></Link>
                      <span className={cx("tabular text-xs", c.marketCapChange24h >= 0 ? "text-up" : "text-down")}>
                        {c.marketCapChange24h >= 0 ? "▲ +" : "▼ −"}{formatCompactMoney(Math.abs(c.marketCapChange24h), currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : g.error || g.data?.analysisError ? (
            <p className="text-sm text-muted">Breadth unavailable — the market sample could not be loaded.</p>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </div>
      </Card>
    </div>
  );
}

/** Movers are limited to the top 250 with non-zero volume, to avoid ranking illiquid micro-caps. */
const MOVER_MAX_RANK = 250;

function MoversWidget({ m }: { m: MarketsPoll }) {
  const rows = m.data?.data ?? [];
  const eligible = rows.filter((r) => r.change24h != null && r.rank != null && r.rank <= MOVER_MAX_RANK && (r.volume24h ?? 0) > 0);
  const gainers = [...eligible].sort((a, b) => b.change24h! - a.change24h!).slice(0, 6);
  const losers = [...eligible].sort((a, b) => a.change24h! - b.change24h!).slice(0, 6);
  if (m.error && !m.data) return <ErrorState title="Top movers unavailable" message={m.error.message} onRetry={m.refetch} />;
  return (
    <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
      <MoverList title="Top gainers (24h)" rows={gainers} loading={m.loading} />
      <MoverList title="Top decliners (24h)" rows={losers} loading={m.loading} />
    </div>
  );
}

function MoverList({ title, rows, loading }: { title: string; rows: MarketRow[]; loading: boolean }) {
  const { currency } = usePrefs();
  return (
    <Card>
      <CardHeader title={title} subtitle="Within the top 250 by market cap" />
      <ul className="divide-y divide-line/60">
        {loading && rows.length === 0 && Array.from({ length: 6 }).map((_, i) => <li key={i} className="px-4 py-2.5"><Skeleton className="h-5 w-full" /></li>)}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/coins/${r.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-panel-2/60">
              <AssetIcon src={r.image} symbol={r.symbol} size={20} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name} <span className="text-xs font-normal text-muted">{r.symbol}</span></span>
              <span className="tabular text-muted">{formatPrice(r.price, currency)}</span>
              <Change value={r.change24h} className="w-20 justify-end" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FavoritesWidget({ m }: { m: MarketsPoll }) {
  const { favorites, currency } = usePrefs();
  const rows = (m.data?.data ?? []).filter((r) => favorites.includes(r.id));
  const missing = favorites.filter((id) => !rows.some((r) => r.id === id));
  return (
    <Card>
      <CardHeader title="Favourites" subtitle="Star assets in any table. Stored in this browser until accounts arrive (Phase 4)." />
      {favorites.length === 0 ? (
        <p className="p-4 text-sm text-muted">No favourites yet — use ☆ in the market tables.</p>
      ) : (
        <ul className="grid gap-px bg-line/60 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="bg-panel">
              <Link href={`/coins/${r.id}`} className="flex items-center gap-2 p-3 hover:bg-panel-2/60">
                <AssetIcon src={r.image} symbol={r.symbol} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="tabular text-xs text-muted">{formatPrice(r.price, currency)}</p>
                </div>
                <Change value={r.change24h} className="text-sm" />
              </Link>
            </li>
          ))}
          {missing.map((id) => (
            <li key={id} className="bg-panel">
              <Link href={`/coins/${id}`} className="block p-3 text-sm text-muted hover:bg-panel-2/60">{id} <span className="text-xs">(outside top 250 — open for details)</span></Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
