export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class RateLimitedError extends ProviderError {
  constructor(provider: string, retryAfterSec?: number) {
    super(`${provider} rate limit reached`, provider, 429, retryAfterSec);
    this.name = "RateLimitedError";
  }
}

export class NotFoundError extends ProviderError {
  constructor(provider: string, what: string) {
    super(`${what} not found`, provider, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ProviderError {
  constructor(provider: string, detail: string) {
    super(`Invalid response from ${provider}: ${detail}`, provider);
    this.name = "ValidationError";
  }
}
