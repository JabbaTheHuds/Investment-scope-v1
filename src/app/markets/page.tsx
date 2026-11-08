"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { MarketTable } from "@/components/market/MarketTable";
import { usePrefs } from "@/components/shell/PreferencesProvider";
import { Freshness } from "@/components/ui/Freshness";
import { Card, ErrorState } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import type { Envelope, MarketRow } from "@/lib/market/types";

const PER_PAGE = 100;
const MAX_PAGE = 100;

function MarketsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const { currency } = usePrefs();
  const page = Math.min(MAX_PAGE, Math.max(1, Number(params.get("page")) || 1));
  const m = usePolled<Envelope<MarketRow[]>>(`/api/markets?currency=${currency}&perPage=${PER_PAGE}&page=${page}`, 60_000);
  const go = (p: number) => router.push(`${path}?page=${p}`);
  const rows = m.data?.data ?? null;
  const hasNext = (rows?.length ?? 0) === PER_PAGE && page < MAX_PAGE;

  return (
    <div className="space-y-4 animate-in">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cryptocurrency Markets</h1>
        <p className="mt-1 text-sm text-muted">
          Ranked by market cap, {PER_PAGE} per page. Column sorting applies to the current page. Prices are volume-weighted aggregates across venues, not a single exchange.
        </p>
        <Freshness meta={m.data?.meta} error={m.error} className="mt-1" />
      </div>
      <Card>
        {m.error && !m.data ? (
          <div className="p-4"><ErrorState message={m.error.message} onRetry={m.refetch} /></div>
        ) : (
          <MarketTable rows={rows} loading={m.loading} caption={`Cryptocurrency markets, page ${page}`} />
        )}
        <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <button onClick={() => go(page - 1)} disabled={page <= 1} className="rounded-md border border-line px-3 py-1 disabled:opacity-40">← Previous</button>
          <span className="tabular text-muted">
            Page {page} · ranks {(page - 1) * PER_PAGE + 1}–{(page - 1) * PER_PAGE + (rows?.length ?? PER_PAGE)}
          </span>
          <button onClick={() => go(page + 1)} disabled={!hasNext} className="rounded-md border border-line px-3 py-1 disabled:opacity-40">Next →</button>
        </nav>
      </Card>
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense>
      <MarketsInner />
    </Suspense>
  );
}
