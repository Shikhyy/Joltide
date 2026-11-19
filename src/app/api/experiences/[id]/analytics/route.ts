import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { analytics } from "@/lib/runtime";
import { HttpError, getAggregate } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const agg = await getAggregate(id);
  if (!agg) throw new HttpError(404, "Not found");
  const key = req.headers.get("x-creator-key");
  if (key !== agg.exp.creatorKey) throw new HttpError(403, "Creator access only");
  return NextResponse.json({
    title: agg.exp.title,
    tagline: agg.exp.tagline,
    theme: agg.exp.theme,
    ...analytics(agg),
  });
});
