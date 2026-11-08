"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SUPPORTED_CURRENCIES, type ChartRange, type Currency } from "@/lib/market/types";

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

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = { ...DEFAULTS, ...JSON.parse(raw) } as Preferences;
    if (!SUPPORTED_CURRENCIES.includes(p.currency)) p.currency = "usd";
    // Keep saved layout but add any widgets introduced since it was saved.
    const known = new Set(p.dashboard.map((w) => w.id));
    p.dashboard = [...p.dashboard.filter((w) => DEFAULT_WIDGETS.some((d) => d.id === w.id)), ...DEFAULT_WIDGETS.filter((d) => !known.has(d.id))];
    return p;
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
