/** Tracks the health of each upstream data source for the status page and freshness UI. */
export interface SourceStatus {
  id: string;
  label: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

const g = globalThis as unknown as { __cryptoscopeStatus?: Map<string, SourceStatus> };
const registry: Map<string, SourceStatus> = (g.__cryptoscopeStatus ??= new Map());

function entry(id: string, label: string): SourceStatus {
  let s = registry.get(id);
  if (!s) {
    s = { id, label, lastSuccessAt: null, lastFailureAt: null, lastError: null, consecutiveFailures: 0, totalRequests: 0, totalFailures: 0 };
    registry.set(id, s);
  }
  return s;
}

export function recordSuccess(id: string, label: string) {
  const s = entry(id, label);
  s.totalRequests++;
  s.consecutiveFailures = 0;
  s.lastSuccessAt = new Date().toISOString();
}

export function recordFailure(id: string, label: string, error: unknown) {
  const s = entry(id, label);
  s.totalRequests++;
  s.totalFailures++;
  s.consecutiveFailures++;
  s.lastFailureAt = new Date().toISOString();
  s.lastError = error instanceof Error ? error.message : String(error);
}

export function getStatuses(): SourceStatus[] {
  return [...registry.values()].map((s) => ({ ...s }));
}
