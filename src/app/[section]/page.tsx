import Link from "next/link";
import { notFound } from "next/navigation";
import { CURRENT_PHASE, NAV } from "@/components/shell/nav";

/** Honest placeholder for sections scheduled in later phases — no fake data or dead controls. */
export function generateStaticParams() {
  return NAV.filter((n) => n.phase > CURRENT_PHASE).map((n) => ({ section: n.href.slice(1) }));
}
export const dynamicParams = false;

export default async function PlannedSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = NAV.find((n) => n.href === `/${section}` && n.phase > CURRENT_PHASE);
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-2xl py-10 animate-in">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Planned · Phase {item.phase}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        <span aria-hidden className="mr-2 text-muted">{item.icon}</span>
        {item.label}
      </h1>
      <p className="mt-3 leading-relaxed text-muted">{item.description}</p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        This section is not implemented yet. Rather than show placeholder numbers, it is intentionally empty until it can run on verified data.
        See <code className="rounded bg-panel-2 px-1">docs/ROADMAP.md</code> for scope and sequencing.
      </p>
      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/" className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2">Market overview</Link>
        <Link href="/markets" className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2">Browse markets</Link>
      </div>
    </div>
  );
}
