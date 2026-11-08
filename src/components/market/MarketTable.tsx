"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePrefs } from "@/components/shell/PreferencesProvider";
import { AssetIcon, Change, cx, Skeleton, Sparkline } from "@/components/ui/primitives";
import { formatCompact, formatCompactMoney, formatPct, formatPrice } from "@/lib/format";
import type { MarketRow } from "@/lib/market/types";

type SortKey = "rank" | "name" | "price" | "change1h" | "change24h" | "change7d" | "change30d" | "marketCap" | "volume24h" | "volMcap";

const volMcap = (r: MarketRow) => (r.volume24h != null && r.marketCap ? r.volume24h / r.marketCap : null);

function sortValue(r: MarketRow, k: SortKey): number | string | null {
  if (k === "volMcap") return volMcap(r);
  if (k === "name") return r.name.toLowerCase();
  return r[k];
}

export function MarketTable({ rows, loading, compact, caption }: { rows: MarketRow[] | null; loading?: boolean; compact?: boolean; caption: string }) {
  const { currency, favorites, toggleFavorite } = usePrefs();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });

  const sorted = useMemo(() => {
    if (!rows) return null;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      // Missing values always sink to the bottom regardless of direction.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
    return copy;
  }, [rows, sort]);

  const th = (key: SortKey, label: string, cls = "", title?: string) => {
    const active = sort.key === key;
    return (
      <th scope="col" className={cx("whitespace-nowrap px-3 py-2 font-medium", cls)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} title={title}>
        <button
          className={cx("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "rank" || key === "name" ? 1 : -1 }))}
        >
          {label}
          <span aria-hidden className="text-[9px]">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-panel text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="w-8 px-2"><span className="sr-only">Favourite</span></th>
            {th("rank", "#", "w-10")}
            {th("name", "Asset", "sticky left-0 bg-panel")}
            {th("price", "Price", "text-right [&>button]:justify-end")}
            {!compact && th("change1h", "1h", "text-right [&>button]:justify-end")}
            {th("change24h", "24h", "text-right [&>button]:justify-end")}
            {th("change7d", "7d", "text-right [&>button]:justify-end")}
            {!compact && th("change30d", "30d", "text-right [&>button]:justify-end")}
            {th("marketCap", "Market cap", "text-right [&>button]:justify-end")}
            {th("volume24h", "Volume 24h", "text-right [&>button]:justify-end")}
            {!compact && th("volMcap", "Vol/MCap", "text-right [&>button]:justify-end", "24h volume ÷ market cap — a rough turnover/liquidity gauge")}
            {!compact && <th scope="col" className="px-3 py-2 text-right font-medium">Circulating</th>}
            <th scope="col" className="px-3 py-2 text-right font-medium">7d trend</th>
          </tr>
        </thead>
        <tbody>
          {loading && !sorted &&
            Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-line/60">
                <td colSpan={13} className="px-3 py-2.5"><Skeleton className="h-5 w-full" /></td>
              </tr>
            ))}
          {sorted?.map((r) => {
            const fav = favorites.includes(r.id);
            return (
              <tr key={r.id} className="border-b border-line/60 hover:bg-panel-2/60">
                <td className="px-2 text-center">
                  <button onClick={() => toggleFavorite(r.id)} aria-pressed={fav} aria-label={fav ? `Remove ${r.name} from favourites` : `Add ${r.name} to favourites`} className={cx("text-base leading-none", fav ? "text-warn" : "text-muted/50 hover:text-muted")}>
                    {fav ? "★" : "☆"}
                  </button>
                </td>
                <td className="tabular px-3 py-2 text-muted">{r.rank ?? "—"}</td>
                <td className="sticky left-0 bg-panel px-3 py-2">
                  <Link href={`/coins/${r.id}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
                    <AssetIcon src={r.image} symbol={r.symbol} size={22} />
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-xs text-muted">{r.symbol}</span>
                  </Link>
                </td>
                <td className="tabular px-3 py-2 text-right font-medium">{formatPrice(r.price, currency)}</td>
                {!compact && <td className="px-3 py-2 text-right"><Change value={r.change1h} /></td>}
                <td className="px-3 py-2 text-right"><Change value={r.change24h} /></td>
                <td className="px-3 py-2 text-right"><Change value={r.change7d} /></td>
                {!compact && <td className="px-3 py-2 text-right"><Change value={r.change30d} /></td>}
                <td className="tabular px-3 py-2 text-right">{formatCompactMoney(r.marketCap, currency)}</td>
                <td className="tabular px-3 py-2 text-right">{formatCompactMoney(r.volume24h, currency)}</td>
                {!compact && <td className="tabular px-3 py-2 text-right text-muted">{volMcap(r) == null ? "—" : formatPct(volMcap(r)! * 100).replace("+", "")}</td>}
                {!compact && <td className="tabular px-3 py-2 text-right text-muted">{r.circulatingSupply == null ? "—" : `${formatCompact(r.circulatingSupply)} ${r.symbol}`}</td>}
                <td className="px-3 py-2 text-right"><span className="inline-block"><Sparkline data={r.sparkline7d} width={100} height={28} label={`${r.name} 7-day price trend`} /></span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
