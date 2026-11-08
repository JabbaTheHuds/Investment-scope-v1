import { z } from "zod";
import { apiHandler, CoinIdParam, CurrencyParam, service } from "@/lib/api/http";
import { CHART_RANGES } from "@/lib/market/types";

export const dynamic = "force-dynamic";

const Query = z.object({ currency: CurrencyParam, range: z.enum(CHART_RANGES).default("30") });

export const GET = apiHandler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = CoinIdParam.parse((await ctx.params).id);
  const { currency, range } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return service().chart(id, currency, range);
});
