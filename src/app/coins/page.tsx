"use client";
import Link from "next/link";
import { usePrefs } from "@/components/shell/PreferencesProvider";
import { AssetIcon, Card, CardHeader, Change, ErrorState, Skeleton } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import { formatPrice } from "@/lib/format";
import type { Envelope, MarketRow } from "@/lib/market/types";

export default function CoinIndexPage() {
  const { currency, favorites, ready } = usePrefs();
  const m = usePolled<Envelope<MarketRow[]>>(ready ? `/api/markets?currency=${currency}&perPage=250&page=1` : null, 60_000);
  const rows = m.data?.data ?? [];
  const favRows = rows.filter((r) => favorites.includes(r.id));
  const list = (title: string, items: MarketRow[]) => (
    <Card>
      <CardHeader title={title} />
      <ul className="grid gap-px bg-line/60 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.id} className="bg-panel">
            <Link href={`/coins/${r.id}`} className="flex items-center gap-2 p-3 text-sm hover:bg-panel-2/60">
              <AssetIcon src={r.image} symbol={r.symbol} size={22} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name} <span className="text-xs font-normal text-muted">{r.symbol}</span></span>
              <span className="tabular text-muted">{formatPrice(r.price, currency)}</span>
              <Change value={r.change24h} className="w-20 justify-end" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
  return (
    <div className="space-y-4 animate-in">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Coin Analysis</h1>
        <p className="mt-1 text-sm text-muted">Choose an asset, or press <kbd className="rounded border border-line px-1 text-xs">/</kbd> to search by name, ticker or contract address.</p>
      </div>
      {m.error && !m.data && <ErrorState message={m.error.message} onRetry={m.refetch} />}
      {(m.loading || !ready) && !m.data && <Skeleton className="h-48 w-full" />}
      {favRows.length > 0 && list("Your favourites", favRows)}
      {rows.length > 0 && list("Largest by market cap", rows.slice(0, 12))}
    </div>
  );
}
