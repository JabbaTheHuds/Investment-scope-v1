"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-xl border border-down/30 bg-down/5 p-6">
      <h1 className="font-semibold text-down">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This view failed to render. No data shown here should be relied upon until it reloads.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref: {error.digest}</p>}
      <button onClick={reset} className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-panel-2">Try again</button>
    </div>
  );
}
