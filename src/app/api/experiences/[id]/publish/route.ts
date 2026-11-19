import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { publish } from "@/lib/runtime";
import { HttpError, withAggregate } from "@/lib/store";

const Body = z.object({ creatorKey: z.string().min(10).max(64) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { creatorKey } = Body.parse(await req.json());
  const out = await withAggregate(id, async (agg) => {
    if (agg.exp.creatorKey !== creatorKey) throw new HttpError(403, "Not your experience");
    await publish(agg);
    return { id: agg.exp.id, status: agg.exp.status, chat: Boolean(agg.exp.groupChannelId) };
  });
  return NextResponse.json(out);
});
