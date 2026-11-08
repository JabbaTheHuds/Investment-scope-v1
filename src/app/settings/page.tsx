"use client";
import { usePrefs, type ChartType, type Theme } from "@/components/shell/PreferencesProvider";
import { Card, CardHeader } from "@/components/ui/primitives";
import { CHART_RANGES, SUPPORTED_CURRENCIES, type ChartRange, type Currency } from "@/lib/market/types";

const ZONES = ["", "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Asia/Kolkata", "Australia/Sydney"];

export default function SettingsPage() {
  const p = usePrefs();
  const field = "h-9 w-full rounded-lg border border-line bg-panel-2 px-2 text-sm";
  return (
    <div className="max-w-3xl space-y-4 animate-in">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader title="Display" subtitle="Stored in this browser. Account-synced settings arrive with sign-in (Phase 4)." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Theme</span>
            <select className={field} value={p.theme} onChange={(e) => p.set("theme", e.target.value as Theme)}>
              <option value="dark">Dark</option><option value="light">Light</option><option value="system">Match system</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Quote currency</span>
            <select className={`${field} uppercase`} value={p.currency} onChange={(e) => p.set("currency", e.target.value as Currency)}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Time zone for dates & charts</span>
            <select className={field} value={p.timeZone} onChange={(e) => p.set("timeZone", e.target.value)}>
              {ZONES.map((z) => <option key={z} value={z}>{z || "Browser default"}</option>)}
            </select>
          </label>
        </div>
      </Card>
      <Card>
        <CardHeader title="Chart defaults" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Chart type</span>
            <select className={field} value={p.chartType} onChange={(e) => p.set("chartType", e.target.value as ChartType)}>
              <option value="candles">Candlestick</option><option value="line">Line</option><option value="area">Area</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Default range (days)</span>
            <select className={field} value={p.chartRange} onChange={(e) => p.set("chartRange", e.target.value as ChartRange)}>
              {CHART_RANGES.map((r) => <option key={r} value={r}>{r === "max" ? "Max" : r}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.showVolume} onChange={(e) => p.set("showVolume", e.target.checked)} /> Show volume pane
          </label>
        </div>
      </Card>
      <Card>
        <CardHeader title="Local data" />
        <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <p className="flex-1 text-muted">{p.favorites.length} favourite(s) saved in this browser.</p>
          <button
            className="rounded-lg border border-down/40 px-3 py-1.5 text-xs text-down hover:bg-down/10"
            onClick={() => {
              if (confirm("Reset all preferences and favourites stored in this browser?")) {
                try { localStorage.removeItem("cryptoscope:prefs:v1"); } catch { /* ignore */ }
                location.reload();
              }
            }}
          >
            Reset preferences
          </button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Account & security" />
        <p className="p-4 text-sm text-muted">
          Accounts (sign-in, MFA, data export and deletion) are planned for Phase 4. CryptoScope AI will never ask for a wallet seed phrase or private key.
        </p>
      </Card>
    </div>
  );
}
