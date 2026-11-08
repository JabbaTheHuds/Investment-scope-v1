/**
 * Token bucket used to keep outbound provider traffic under plan limits.
 * `tryAcquire` never blocks: if no token is available the caller should fail
 * fast and let the cache serve the last good (stale-labelled) value.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private blockedUntil = 0;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  private refill() {
    const t = this.now();
    const elapsed = (t - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.last = t;
  }

  tryAcquire(): boolean {
    if (this.now() < this.blockedUntil) return false;
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Called when the provider itself returns 429, honouring Retry-After. */
  blockFor(seconds: number) {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + seconds * 1000);
    this.tokens = 0;
  }

  /** Approximate ms until the next request is allowed. */
  waitMs(): number {
    const t = this.now();
    if (t < this.blockedUntil) return this.blockedUntil - t;
    this.refill();
    return this.tokens >= 1 ? 0 : Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
  }
}

/** Fixed-window per-key limiter for inbound API traffic. */
export class WindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    let h = this.hits.get(key);
    if (!h || h.resetAt <= t) {
      h = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, h);
      if (this.hits.size > 10_000) this.sweep(t);
    }
    h.count++;
    return { ok: h.count <= this.limit, retryAfterSec: Math.ceil((h.resetAt - t) / 1000) };
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
