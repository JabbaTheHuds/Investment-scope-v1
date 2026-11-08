import { z } from "zod";
import { apiHandler, CurrencyParam, service } from "@/lib/api/http";

export const dynamic = "force-dynamic";

const Query = z.object({
  currency: CurrencyParam,
  page: z.coerce.number().int().min(1).max(200).default(1),
  perPage: z.coerce.number().int().min(10).max(250).default(100),
});

export const GET = apiHandler(async (req) => {
  const q = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return service().markets(q.currency, q.page, q.perPage);
});
