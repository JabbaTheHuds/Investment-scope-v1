"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePolled } from "@/hooks/usePolled";
import { SUPPORTED_CURRENCIES, type Currency } from "@/lib/market/types";
import { cx } from "@/components/ui/primitives";
import { CURRENT_PHASE, NAV } from "./nav";
import { usePrefs, type Theme } from "./PreferencesProvider";
import { SearchBox } from "./SearchBox";

interface StatusResp {
  mode: "live" | "demo";
  provider: { label: string; attribution: { text: string; url: string } };
}

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/coins") return path === "/coins" || path.startsWith("/coins/");
  return path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const status = usePolled<StatusResp>("/api/status", 5 * 60_000);
  const { currency, theme, set } = usePrefs();

  useEffect(() => setNavOpen(false), [path]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>

      {/* Sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full max-lg:invisible",
        )}
        aria-label="Primary"
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white">◈</span>
          <span className="font-semibold tracking-tight">CryptoScope <span className="text-accent">AI</span></span>
        </div>
        <nav className="h-[calc(100dvh-3.5rem)] overflow-y-auto p-2 scroll-thin">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = isActive(path, item.href);
              const planned = item.phase > CURRENT_PHASE;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                      active ? "bg-accent/15 text-fg" : "text-muted hover:bg-panel-2 hover:text-fg",
                    )}
                  >
                    <span aria-hidden className={cx("w-4 text-center", active && "text-accent")}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {planned && <span className="ml-auto rounded border border-line px-1 text-[9px] uppercase text-muted" title={`Planned for phase ${item.phase}`}>P{item.phase}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-line px-2.5 pt-3 text-[11px] leading-relaxed text-muted">
            <Link href="/status" className="hover:text-fg">Data sources &amp; status →</Link>
            <p className="mt-2">Information only — not financial advice.</p>
          </div>
        </nav>
      </aside>
      {navOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur">
          <button className="rounded-md border border-line px-2 py-1 lg:hidden" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            ☰
          </button>
          <SearchBox />
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="currency">Quote currency</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => set("currency", e.target.value as Currency)}
              className="h-9 rounded-lg border border-line bg-panel-2 px-2 text-sm uppercase"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="theme">Theme</label>
            <select id="theme" value={theme} onChange={(e) => set("theme", e.target.value as Theme)} className="hidden h-9 rounded-lg border border-line bg-panel-2 px-2 text-sm sm:block">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
        </header>

        {status.data?.mode === "demo" && (
          <div role="alert" className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-xs font-medium text-warn">
            DEMO MODE — all assets and figures are synthetic and fictional. Set DATA_MODE=live for real market data.
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 lg:px-6">{children}</main>

        <footer className="border-t border-line px-4 py-3 text-[11px] text-muted lg:px-6">
          {status.data ? (
            <span>
              {status.data.provider.attribution.text.startsWith("SYNTHETIC") ? (
                status.data.provider.attribution.text
              ) : (
                <a href={status.data.provider.attribution.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {status.data.provider.attribution.text}
                </a>
              )}
              {" · "}Market data can be delayed or incomplete. CryptoScope AI does not provide investment advice.
            </span>
          ) : (
            <span>CryptoScope AI does not provide investment advice.</span>
          )}
        </footer>
      </div>
    </div>
  );
}
