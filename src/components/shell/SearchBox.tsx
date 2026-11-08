"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Envelope, SearchResult } from "@/lib/market/types";
import { AssetIcon, cx } from "@/components/ui/primitives";

/**
 * Global asset search: name, ticker or contract address (EVM chains & Solana).
 * Keyboard: "/" focuses, ↑/↓ moves, Enter opens, Esc closes.
 */
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errMsg, setErrMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        setResults((body as Envelope<SearchResult[]>).data);
        setActive(0);
        setStatus("done");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErrMsg((e as Error).message);
        setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQ("");
    router.push(`/coins/${r.id}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor={`${listId}-input`} className="sr-only">Search assets by name, ticker or contract address</label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && results[active]) go(results[active]);
          else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Search name, ticker or contract…"
        className="h-9 w-full rounded-lg border border-line bg-panel-2 pl-8 pr-10 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        autoComplete="off"
        spellCheck={false}
      />
      <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">⌕</span>
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-muted sm:block">/</kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-2xl animate-in">
          {status === "loading" && results.length === 0 && <p className="px-3 py-2 text-xs text-muted">Searching…</p>}
          {status === "error" && <p className="px-3 py-2 text-xs text-down">{errMsg}</p>}
          {status === "done" && results.length === 0 && <p className="px-3 py-2 text-xs text-muted">No matching assets.</p>}
          <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto scroll-thin">
            {results.map((r, i) => (
              <li
                key={`${r.id}-${r.chain ?? ""}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active && "bg-panel-2")}
              >
                <AssetIcon src={r.thumb} symbol={r.symbol} size={20} />
                <span className="truncate font-medium">{r.name}</span>
                <span className="text-xs text-muted">{r.symbol}</span>
                {r.matchedBy === "contract" && <span className="text-[10px] text-accent">contract · {r.chain}</span>}
                <span className="ml-auto text-xs text-muted tabular">{r.rank ? `#${r.rank}` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-[10px] text-muted">Tickers are not unique — check the name and rank before opening.</p>
        </div>
      )}
    </div>
  );
}
