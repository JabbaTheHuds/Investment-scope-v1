export interface NavItem {
  href: string;
  label: string;
  icon: string; // single glyph; keeps bundle small and accessible via label
  /** Implementation phase; items above the current phase render a "planned" page. */
  phase: number;
  description: string;
}

export const CURRENT_PHASE = 1;

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "◧", phase: 1, description: "Global market state, breadth and movers." },
  { href: "/markets", label: "Markets", icon: "≣", phase: 1, description: "All tracked assets with sortable metrics." },
  { href: "/coins", label: "Coin Analysis", icon: "◎", phase: 1, description: "Per-asset statistics, venues and charts." },
  { href: "/analyst", label: "AI Analyst", icon: "✦", phase: 3, description: "Source-grounded conversational market analysis with explicit uncertainty." },
  { href: "/technical", label: "Technical Analysis", icon: "∿", phase: 2, description: "Indicator dashboards (RSI, MACD, ADX, ATR, OBV, VWAP) across assets." },
  { href: "/news", label: "News & Events", icon: "▤", phase: 3, description: "Licensed news aggregation, significance classification and economic calendar." },
  { href: "/portfolio", label: "Portfolio", icon: "◫", phase: 4, description: "Transaction-based portfolio accounting, CSV import/export and stress tests." },
  { href: "/watchlists", label: "Watchlists", icon: "☆", phase: 4, description: "Saved, account-synced watchlists. Phase 1 favourites are stored in this browser." },
  { href: "/scanner", label: "Market Scanner", icon: "⌕", phase: 2, description: "Rule-based screens computed on scheduled, cached indicator snapshots." },
  { href: "/alerts", label: "Alerts", icon: "⚑", phase: 4, description: "Price, indicator and news alerts with cooldowns and delivery tracking." },
  { href: "/risk", label: "Risk Dashboard", icon: "△", phase: 2, description: "Market regime classification, volatility, liquidity and concentration." },
  { href: "/history", label: "Historical Analysis", icon: "⟲", phase: 5, description: "Point-in-time research and look-ahead-safe strategy backtesting." },
  { href: "/paper-trading", label: "Paper Trading", icon: "⇄", phase: 5, description: "Simulated orders with virtual capital — no real funds." },
  { href: "/settings", label: "Settings", icon: "⚙", phase: 1, description: "Theme, currency, time zone and chart preferences." },
];
