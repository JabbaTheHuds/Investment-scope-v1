import { z } from "zod";
import { apiHandler, CurrencyParam, service } from "@/lib/api/http";
import { computeBreadth, topContributors } from "@/lib/market/derive";

export const dynamic = "force-dynamic";

const Query = z.object({ currency: CurrencyParam });
const BREADTH_SAMPLE = 250;

/**
 * Global stats plus breadth & contributor analysis computed from the top-250 sample.
 * A breadth failure does not fail the response — it is reported as null with a reason.
 */
export const GET = apiHandler(async (req) => {
  const { currency } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const svc = service();
  const [global, sample] = await Promise.all([svc.global(currency), Promise.allSettled([svc.markets(currency, 1, BREADTH_SAMPLE)]).then((r) => r[0])]);
  if (sample.status === "rejected") {
    return { ...global, analysis: null, analysisError: sample.reason instanceof Error ? sample.reason.message : "unavailable" };
  }
  const rows = sample.value.data;
  return {
    ...global,
    analysis: {
      sampleDescription: `Top ${rows.length} assets by market cap`,
      breadth: computeBreadth(rows),
      contributors: topContributors(rows, 6),
      sampleMeta: sample.value.meta,
    },
    analysisError: null,
  };
});
