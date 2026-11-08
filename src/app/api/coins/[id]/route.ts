import { z } from "zod";
import { apiHandler, CoinIdParam, CurrencyParam, service } from "@/lib/api/http";

export const dynamic = "force-dynamic";

const Query = z.object({ currency: CurrencyParam });

export const GET = apiHandler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = CoinIdParam.parse((await ctx.params).id);
  const { currency } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return service().coin(id, currency);
});
