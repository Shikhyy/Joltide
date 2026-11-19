import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { requirePlayer } from "@/lib/player";
import { addDemoBot, view } from "@/lib/runtime";
import { HttpError, withAggregate } from "@/lib/store";

const Body = z.object({ userId: z.string().regex(USER_ID) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { userId } = Body.parse(await req.json());
  requirePlayer(req, userId);
  const out = await withAggregate(id, async (agg) => {
    if (!agg.members.some((m) => m.userId === userId)) throw new HttpError(403, "Join first");
    await addDemoBot(agg);
    return view(agg, userId);
  });
  return NextResponse.json(out);
});
