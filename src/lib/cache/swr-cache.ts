/**
 * In-process stale-while-error cache with in-flight request coalescing.
 *
 * - Fresh entries are served directly.
 * - Expired entries trigger one (deduplicated) refresh.
 * - If the refresh fails and a previous value exists within `maxStaleMs`,
 *   that value is returned with `stale: true` and the failure reason, so the UI
 *   can label it honestly instead of presenting it as current.
 * - If nothing usable is cached, the error propagates.
 *
 * The interface is intentionally small so a Redis-backed implementation can be
 * swapped in once multiple server instances share a cache.
 */

export interface CacheResult<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
  staleReason: string | null;
}

interface Entry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttlMs: number;
  /** How long past expiry a value may still be served (flagged stale) on failure. */
  maxStaleMs: number;
}

export class SwrCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<Entry<unknown>>>();

  constructor(
    private readonly maxEntries = 2000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string, opts: CacheOptions, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const existing = this.store.get(key) as Entry<T> | undefined;
    const t = this.now();
    if (existing && existing.expiresAt > t) {
      return { value: existing.value, fetchedAt: existing.fetchedAt, stale: false, staleReason: null };
    }

    try {
      const entry = (await this.refresh(key, opts, loader)) as Entry<T>;
      return { value: entry.value, fetchedAt: entry.fetchedAt, stale: false, staleReason: null };
    } catch (err) {
      if (existing && t - existing.expiresAt <= opts.maxStaleMs) {
        return {
          value: existing.value,
          fetchedAt: existing.fetchedAt,
          stale: true,
          staleReason: err instanceof Error ? err.message : "Refresh failed",
        };
      }
      throw err;
    }
  }

  private refresh<T>(key: string, opts: CacheOptions, loader: () => Promise<T>): Promise<Entry<unknown>> {
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = (async () => {
      try {
        const value = await loader();
        const fetchedAt = this.now();
        const entry: Entry<T> = { value, fetchedAt, expiresAt: fetchedAt + opts.ttlMs };
        this.set(key, entry);
        return entry as Entry<unknown>;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  private set(key: string, entry: Entry<unknown>) {
    this.store.delete(key);
    this.store.set(key, entry);
    // Map preserves insertion order → evict least-recently-written.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
    this.inflight.clear();
  }
}

const g = globalThis as unknown as { __cryptoscopeCache?: SwrCache };
/** Process-wide singleton (survives dev hot-reload). */
export const marketCache: SwrCache = (g.__cryptoscopeCache ??= new SwrCache());
