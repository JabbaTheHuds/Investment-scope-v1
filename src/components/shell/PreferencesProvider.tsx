"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CHART_RANGES, SUPPORTED_CURRENCIES, type ChartRange, type Currency } from "@/lib/market/types";

export type Theme = "dark" | "light" | "system";
export type ChartType = "candles" | "line" | "area";
export type Overlay = "sma20" | "sma50" | "sma200" | "ema20" | "bb";

export type WidgetId = "stats" | "summary" | "movers" | "favorites" | "table";
export interface WidgetPref { id: WidgetId; visible: boolean }
export const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "stats", visible: true },
  { id: "summary", visible: true },
  { id: "movers", visible: true },
  { id: "favorites", visible: true },
  { id: "table", visible: true },
];

export interface Preferences {
  currency: Currency;
  theme: Theme;
  timeZone: string; // "" = browser default
  chartType: ChartType;
  chartRange: ChartRange;
  overlays: Overlay[];
  showVolume: boolean;
  favorites: string[];
  dashboard: WidgetPref[];
}

const DEFAULTS: Preferences = {
  currency: "usd",
  theme: "dark",
  timeZone: "",
  chartType: "candles",
  chartRange: "30",
  overlays: ["sma20"],
  showVolume: true,
  favorites: [],
  dashboard: DEFAULT_WIDGETS,
};
const KEY = "cryptoscope:prefs:v1";

interface Ctx extends Preferences {
  set: <K extends keyof Preferences>(k: K, v: Preferences[K]) => void;
  toggleFavorite: (id: string) => void;
  ready: boolean;
}

const PrefCtx = createContext<Ctx | null>(null);

const THEMES: Theme[] = ["dark", "light", "system"];
const CHART_TYPES: ChartType[] = ["candles", "line", "area"];
const OVERLAY_IDS: Overlay[] = ["sma20", "sma50", "sma200", "ema20", "bb"];
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function validTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || tz === "") return "";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "";
  }
}

/**
 * Parses stored preferences field by field. Anything invalid or from an older
 * version falls back to its default, so corrupted storage can never break the app.
 */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return DEFAULTS;
  let o: Record<string, unknown>;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return DEFAULTS;
    o = v as Record<string, unknown>;
  } catch {
    return DEFAULTS;
  }
  const pick = <T,>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  let dashboard = DEFAULTS.dashboard;
  if (Array.isArray(o.dashboard)) {
    const seen = new Set<WidgetId>();
    const saved = (o.dashboard as unknown[]).filter((w): w is WidgetPref => {
      if (!w || typeof w !== "object") return false;
      const { id, visible } = w as WidgetPref;
      if (!DEFAULT_WIDGETS.some((d) => d.id === id) || typeof visible !== "boolean" || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // Keep the saved layout but append any widgets introduced since it was saved.
    dashboard = [...saved.map((w) => ({ id: w.id, visible: w.visible })), ...DEFAULT_WIDGETS.filter((d) => !seen.has(d.id))];
  }
  return {
    currency: pick(o.currency, SUPPORTED_CURRENCIES, DEFAULTS.currency),
    theme: pick(o.theme, THEMES, DEFAULTS.theme),
    timeZone: validTimeZone(o.timeZone),
    chartType: pick(o.chartType, CHART_TYPES, DEFAULTS.chartType),
    chartRange: pick(o.chartRange, CHART_RANGES, DEFAULTS.chartRange),
    overlays: isStrArr(o.overlays) ? [...new Set(o.overlays.filter((x): x is Overlay => OVERLAY_IDS.includes(x as Overlay)))] : DEFAULTS.overlays,
    showVolume: typeof o.showVolume === "boolean" ? o.showVolume : DEFAULTS.showVolume,
    favorites: isStrArr(o.favorites) ? [...new Set(o.favorites)].slice(0, 500) : DEFAULTS.favorites,
    dashboard,
  };
}

function load(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

/**
 * Per-browser UI preferences (Phase 1). Phase 4 moves these to the user account
 * (UserPreference table) when authentication lands.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — preferences last for this session only */
    }
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs, ready]);

  const set = useCallback(<K extends keyof Preferences>(k: K, v: Preferences[K]) => setPrefs((p) => ({ ...p, [k]: v })), []);
  const toggleFavorite = useCallback(
    (id: string) => setPrefs((p) => ({ ...p, favorites: p.favorites.includes(id) ? p.favorites.filter((x) => x !== id) : [...p.favorites, id] })),
    [],
  );

  const value = useMemo(() => ({ ...prefs, set, toggleFavorite, ready }), [prefs, set, toggleFavorite, ready]);
  return <PrefCtx.Provider value={value}>{children}</PrefCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefCtx);
  if (!c) throw new Error("usePrefs must be used inside PreferencesProvider");
  return c;
}

/** Inline script to apply the saved theme before first paint (avoids a flash). */
export const themeInitScript = `try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');document.documentElement.dataset.theme=p.theme||'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;
