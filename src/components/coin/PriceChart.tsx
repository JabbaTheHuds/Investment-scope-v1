"use client";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  TickMarkType,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefs, type ChartType, type Overlay } from "@/components/shell/PreferencesProvider";
import { Freshness } from "@/components/ui/Freshness";
import { Card, cx, ErrorState, Skeleton } from "@/components/ui/primitives";
import { usePolled } from "@/hooks/usePolled";
import { bollinger, ema, sma, type Series } from "@/lib/indicators";
import { formatCompactMoney, formatPrice } from "@/lib/format";
import type { ChartResponse } from "@/lib/market/api-types";
import { CHART_RANGES, type Candle, type ChartRange } from "@/lib/market/types";

const RANGE_LABEL: Record<ChartRange, string> = { "1": "1D", "7": "7D", "30": "30D", "90": "90D", "180": "180D", "365": "1Y", max: "Max" };
const OVERLAYS: { id: Overlay; label: string; color: string; period: number }[] = [
  { id: "sma20", label: "SMA 20", color: "#f5a524", period: 20 },
  { id: "sma50", label: "SMA 50", color: "#4f8cff", period: 50 },
  { id: "sma200", label: "SMA 200", color: "#e879f9", period: 200 },
  { id: "ema20", label: "EMA 20", color: "#2dd4bf", period: 20 },
  { id: "bb", label: "Bollinger (20, 2)", color: "#8b93a1", period: 20 },
];

/** Axis tick labels in the user's chosen time zone (the library defaults to UTC). */
export function tickLabel(t: number, type: TickMarkType, timeZone?: string): string {
  const d = new Date(t * 1000);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { ...o, timeZone }).format(d);
  switch (type) {
    case TickMarkType.Year: return f({ year: "numeric" });
    case TickMarkType.Month: return f({ month: "short" });
    case TickMarkType.DayOfMonth: return f({ day: "numeric", month: "short" });
    case TickMarkType.Time: return f({ hour: "2-digit", minute: "2-digit" });
    default: return f({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toLine(candles: Candle[], s: Series) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  s.forEach((v, i) => v != null && out.push({ time: candles[i]!.time as UTCTimestamp, value: v }));
  return out;
}

interface Legend {
  time: number;
  o: number; h: number; l: number; c: number;
  vol: number | null;
}

export function PriceChart({ coinId, onCandles }: { coinId: string; onCandles?: (c: ChartResponse | null) => void }) {
  const { currency, chartType, chartRange, overlays, showVolume, set, timeZone, ready } = usePrefs();
  const res = usePolled<ChartResponse>(ready ? `/api/coins/${encodeURIComponent(coinId)}/chart?currency=${currency}&range=${chartRange}` : null, 5 * 60_000);
  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [legend, setLegend] = useState<Legend | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the indicators menu on an outside tap/click or Escape.
  useEffect(() => {
    const close = () => menuRef.current?.removeAttribute("open");
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuRef.current?.open) {
        close();
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => setCanFull(!!document.fullscreenEnabled && typeof wrapRef.current?.requestFullscreen === "function"), []);

  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const data = res.data?.data;

  useEffect(() => onCandles?.(res.data ?? null), [res.data, onCandles]);

  // Re-theme the chart when the document theme changes.
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((t) => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const volByTime = useMemo(() => new Map((data?.volumes ?? []).map((v) => [v.time, v.value])), [data]);

  // Build / rebuild the chart when inputs that change series structure change.
  useEffect(() => {
    const el = elRef.current;
    if (!el || !data || data.candles.length === 0) return;
    const up = cssVar("--up"), down = cssVar("--down"), fg = cssVar("--muted"), line = cssVar("--line"), bg = cssVar("--panel"), accent = cssVar("--accent");
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: fg, fontFamily: "inherit", attributionLogo: true, panes: { separatorColor: line } },
      grid: { vertLines: { color: line + "66" }, horzLines: { color: line + "66" } },
      rightPriceScale: { borderColor: line },
      timeScale: {
        borderColor: line,
        timeVisible: chartRange === "1" || chartRange === "7" || chartRange === "30",
        secondsVisible: false,
        tickMarkFormatter: (t: Time, type: TickMarkType) => tickLabel(t as number, type, timeZone || undefined),
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        timeFormatter: (t: Time) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || undefined }).format(new Date((t as number) * 1000)),
      },
    });
    chartRef.current = chart;
    const candles = data.candles;
    const priceFormat = { type: "custom" as const, minMove: 1e-8, formatter: (p: number) => formatPrice(p, currency) };
    let main: ISeriesApi<SeriesType>;
    if (chartType === "candles") {
      main = chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false, priceFormat });
      main.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    } else if (chartType === "line") {
      main = chart.addSeries(LineSeries, { color: accent, lineWidth: 2, priceFormat });
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    } else {
      main = chart.addSeries(AreaSeries, { lineColor: accent, topColor: accent + "55", bottomColor: accent + "05", lineWidth: 2, priceFormat });
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    }

    const closes = candles.map((c) => c.close);
    for (const o of OVERLAYS) {
      if (!overlays.includes(o.id) || candles.length < o.period) continue;
      if (o.id === "bb") {
        const b = bollinger(closes, 20, 2);
        for (const s of [b.upper, b.middle, b.lower]) {
          chart.addSeries(LineSeries, { color: o.color, lineWidth: 1, lineStyle: s === b.middle ? 2 : 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat }).setData(toLine(candles, s));
        }
      } else {
        const s = o.id.startsWith("ema") ? ema(closes, o.period) : sma(closes, o.period);
        chart.addSeries(LineSeries, { color: o.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat }).setData(toLine(candles, s));
      }
    }

    if (showVolume && data.volumes.length) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "custom", minMove: 1, formatter: (v: number) => formatCompactMoney(v, currency) }, color: accent + "66", priceLineVisible: false, lastValueVisible: false }, 1);
      vol.setData(data.volumes.map((v) => ({ time: v.time as UTCTimestamp, value: v.value })));
      chart.panes()[1]?.setHeight(90);
    }
    chart.timeScale().fitContent();

    const byTime = new Map(candles.map((c) => [c.time, c]));
    const setLast = () => {
      const c = candles[candles.length - 1]!;
      setLegend({ time: c.time, o: c.open, h: c.high, l: c.low, c: c.close, vol: volByTime.get(c.time) ?? null });
    };
    setLast();
    chart.subscribeCrosshairMove((p) => {
      const c = p.time != null ? byTime.get(p.time as number) : undefined;
      if (!c) return setLast();
      setLegend({ time: c.time, o: c.open, h: c.high, l: c.low, c: c.close, vol: volByTime.get(c.time) ?? null });
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, chartType, overlays, showVolume, currency, chartRange, timeZone, themeTick, volByTime]);

  const exportPng = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${coinId}-${RANGE_LABEL[chartRange]}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };
  const toggleOverlay = (id: Overlay) => set("overlays", overlays.includes(id) ? overlays.filter((x) => x !== id) : [...overlays, id]);
  const maxDays = data?.maxHistoryDays;

  return (
    <Card>
      <div ref={wrapRef} className="flex h-full flex-col bg-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <div role="group" aria-label="Time range" className="flex flex-wrap rounded-lg border border-line p-0.5">
            {CHART_RANGES.map((r) => {
              const disabled = r === "max" && maxDays != null;
              return (
                <button key={r} disabled={disabled} title={disabled ? `Your data plan provides at most ${maxDays} days of history` : undefined} onClick={() => set("chartRange", r)} aria-pressed={chartRange === r} className={cx("rounded-md px-2 py-1 text-xs disabled:opacity-35", chartRange === r ? "bg-accent/20 text-fg" : "text-muted hover:text-fg")}>
                  {RANGE_LABEL[r]}
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Chart type" className="flex rounded-lg border border-line p-0.5">
            {(["candles", "line", "area"] as ChartType[]).map((t) => (
              <button key={t} onClick={() => set("chartType", t)} aria-pressed={chartType === t} className={cx("rounded-md px-2 py-1 text-xs capitalize", chartType === t ? "bg-accent/20 text-fg" : "text-muted hover:text-fg")}>{t}</button>
            ))}
          </div>
          <details ref={menuRef} className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-fg">Indicators ({overlays.length})</summary>
            <div className="absolute left-0 top-full z-20 mt-1 w-56 max-w-[80vw] rounded-lg border border-line bg-panel p-2 shadow-xl">
              {OVERLAYS.map((o) => (
                <label key={o.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-panel-2">
                  <input type="checkbox" checked={overlays.includes(o.id)} onChange={() => toggleOverlay(o.id)} />
                  <span className="h-0.5 w-3" style={{ background: o.color }} />
                  {o.label}
                  {data && data.candles.length < o.period && <span className="ml-auto text-[10px] text-warn">needs {o.period}</span>}
                </label>
              ))}
              <label className="mt-1 flex items-center gap-2 border-t border-line px-1.5 pt-2 text-xs">
                <input type="checkbox" checked={showVolume} onChange={(e) => set("showVolume", e.target.checked)} /> Volume pane
              </label>
              <p className="mt-2 px-1.5 text-[10px] leading-snug text-muted">Periods are counted in candles at the current granularity (e.g. SMA 20 on 4-hour candles ≈ 3.3 days), not calendar days.</p>
            </div>
          </details>
          <div className="ml-auto flex gap-1">
            <button onClick={exportPng} disabled={!data} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-fg disabled:opacity-40">Export PNG</button>
            {canFull && (
              <button onClick={fullscreen} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-fg" aria-label={isFull ? "Exit full screen" : "Full screen chart"}>
                {isFull ? "✕" : "⤢"}
              </button>
            )}
          </div>
        </div>

        <div className="tabular flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs text-muted" aria-live="off">
          {legend && (
            <>
              <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || undefined }).format(new Date(legend.time * 1000))}</span>
              <span>O <b className="font-medium text-fg">{formatPrice(legend.o, currency)}</b></span>
              <span>H <b className="font-medium text-fg">{formatPrice(legend.h, currency)}</b></span>
              <span>L <b className="font-medium text-fg">{formatPrice(legend.l, currency)}</b></span>
              <span>C <b className={cx("font-medium", legend.c >= legend.o ? "text-up" : "text-down")}>{formatPrice(legend.c, currency)}</b></span>
              {legend.vol != null && <span title="Rolling 24h aggregated volume at this time — not volume traded within this candle">24h vol {formatCompactMoney(legend.vol, currency)}</span>}
            </>
          )}
        </div>

        <div className={cx("relative px-1 pb-1", isFull ? "h-[calc(100dvh-7.5rem)]" : "h-[420px] max-sm:h-[320px]")}>
          {res.loading && !data && <Skeleton className="absolute inset-3" />}
          {res.error && !data && <div className="p-4"><ErrorState message={res.error.message} onRetry={res.refetch} /></div>}
          {data && data.candles.length === 0 && <p className="p-6 text-sm text-muted">The provider returned no price history for this range.</p>}
          <div ref={elRef} className="h-full w-full" role="img" aria-label={`Price chart, ${RANGE_LABEL[chartRange]} range`} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-muted">
          <span>
            {data ? `${data.candles.length} candles · ${data.granularity} granularity · timestamps mark candle ${data.candleTimeConvention}` : " "}
            {data?.volumeKind === "rolling-24h" && " · volume pane shows rolling 24h aggregate volume"}
            {chartRange === "max" && maxDays != null && ` · limited to ${maxDays} days by data plan`}
          </span>
          <Freshness meta={res.data?.meta} error={res.error} compact />
        </div>
      </div>
    </Card>
  );
}
