"use client";
import { Badge, Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import { formatAgo } from "@/lib/format";
import type { SourceStatus } from "@/lib/market/status";

interface StatusResp {
  mode: "live" | "demo";
  provider: { id: string; label: string; attribution: { text: string; url: string }; capabilities: { maxHistoryDays: number | null; realtime: boolean; refreshIntervalSec: number }; priceKind: string };
  coingeckoPlan: string | null;
  apiKeyConfigured: boolean;
  sources: SourceStatus[];
  cacheEntries: number;
  serverTime: string;
}

export default function StatusPage() {
  const s = usePolled<StatusResp>("/api/status", 15_000);
  const d = s.data;
  return (
    <div className="max-w-4xl space-y-4 animate-in">
      <h1 className="text-xl font-semibold tracking-tight">Data sources &amp; status</h1>
      {s.error && !d && <ErrorState message={s.error.message} onRetry={s.refetch} />}
      {!d && !s.error && <Skeleton className="h-40 w-full" />}
      {d && (
        <>
          <Card>
            <CardHeader title="Configuration" right={<Badge tone={d.mode === "demo" ? "warn" : "up"}>{d.mode === "demo" ? "DEMO (synthetic)" : "LIVE"}</Badge>} />
            <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Market data provider</dt><dd>{d.provider.label}</dd></div>
              {d.coingeckoPlan && <div><dt className="text-muted">CoinGecko plan</dt><dd className="capitalize">{d.coingeckoPlan} {d.apiKeyConfigured ? "(API key configured)" : "(no API key)"}</dd></div>}
              <div><dt className="text-muted">Price type</dt><dd className="capitalize">{d.provider.priceKind} across venues</dd></div>
              <div><dt className="text-muted">Real-time streaming</dt><dd>{d.provider.capabilities.realtime ? "Yes" : `No — server refreshes about every ${d.provider.capabilities.refreshIntervalSec}s`}</dd></div>
              <div><dt className="text-muted">Historical depth</dt><dd>{d.provider.capabilities.maxHistoryDays ? `Up to ${d.provider.capabilities.maxHistoryDays} days` : "Full history"}</dd></div>
              <div><dt className="text-muted">Server cache entries</dt><dd className="tabular">{d.cacheEntries}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Attribution</dt><dd>{d.provider.attribution.text}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Upstream health" subtitle="Since this server process started" />
            {d.sources.length === 0 ? (
              <p className="p-4 text-sm text-muted">No upstream requests yet{d.mode === "demo" ? " (demo mode makes none)" : ""}.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="px-4 py-2 font-medium">Source</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">Last success</th><th className="px-3 py-2 font-medium">Requests / failures</th><th className="px-4 py-2 font-medium">Last error</th></tr></thead>
                <tbody>
                  {d.sources.map((x) => (
                    <tr key={x.id} className="border-b border-line/60">
                      <td className="px-4 py-2">{x.label}</td>
                      <td className="px-3 py-2">{x.consecutiveFailures === 0 ? <Badge tone="up">Operational</Badge> : x.consecutiveFailures < 3 ? <Badge tone="warn">Degraded</Badge> : <Badge tone="down">Failing</Badge>}</td>
                      <td className="px-3 py-2 text-muted">{formatAgo(x.lastSuccessAt)}</td>
                      <td className="tabular px-3 py-2">{x.totalRequests} / {x.totalFailures}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-xs text-muted" title={x.lastError ?? ""}>{x.lastError ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <CardHeader title="Data integrity rules" />
            <ul className="list-disc space-y-1.5 p-4 pl-8 text-sm text-muted">
              <li>Assets are identified by provider id, never by ticker symbol alone — different assets share tickers.</li>
              <li>Missing values are shown as “—”, never replaced with zero.</li>
              <li>If a refresh fails, the last good value is served and explicitly marked <span className="text-down">Stale</span>.</li>
              <li>Live mode never falls back to demo data.</li>
              <li>Aggregated prices and exchange-specific prices are labelled separately.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
