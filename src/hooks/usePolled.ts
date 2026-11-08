"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
}

export interface Polled<T> {
  data: T | null;
  error: ApiErrorShape | null;
  loading: boolean;
  /** When this browser last received a response from our API. */
  receivedAt: number | null;
  refetch: () => void;
}

/**
 * Fetches a JSON endpoint and re-polls on an interval. Polling pauses while the
 * tab is hidden. On a failed refresh the last good data is kept AND the error is
 * exposed, so the UI can mark it stale instead of silently presenting it as current.
 */
export function usePolled<T>(url: string | null, intervalMs: number): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const urlRef = useRef(url);
  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const res = await fetch(u, { signal: ctrl.signal, cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (urlRef.current !== u) return;
      if (!res.ok) {
        setError({ status: res.status, code: body?.error?.code ?? "http_error", message: body?.error?.message ?? `Request failed (${res.status})` });
      } else {
        setData(body as T);
        setError(null);
        setReceivedAt(Date.now());
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError({ status: 0, code: "network", message: "Network error — check your connection." });
    } finally {
      if (urlRef.current === u) setLoading(false);
    }
  }, []);

  useEffect(() => {
    urlRef.current = url;
    setData(null);
    setError(null);
    setReceivedAt(null);
    setLoading(!!url);
    if (!url) return;
    void load();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void load();
    }, intervalMs);
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      ctrlRef.current?.abort();
    };
  }, [url, intervalMs, load]);

  return { data, error, loading, receivedAt, refetch: load };
}

/** Re-render every `ms` so relative times ("8 seconds ago") stay current. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
