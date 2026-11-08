import { z } from "zod";
import { apiHandler, service } from "@/lib/api/http";

export const dynamic = "force-dynamic";

const Query = z.object({ q: z.string().trim().min(1).max(64).regex(/^[\p{L}\p{N} ._-]+$/u, "unsupported characters") });

export const GET = apiHandler(async (req) => {
  const { q } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return service().search(q);
});
