import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { joinExperience, view } from "@/lib/runtime";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { withAggregate } from "@/lib/store";

const Body = z.object({ userId: z.string().regex(USER_ID), name: z.string().min(1).max(32), ref: z.string().regex(/^[a-zA-Z0-9-]{1,20}$/).optional() });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "join", 30, 60_000);
  const { id } = await ctx.params;
  const { userId, name, ref } = Body.parse(await req.json());
  requirePlayer(req, userId);
  const out = await withAggregate(id, async (agg) => {
    await joinExperience(agg, userId, name, ref);
    return view(agg, userId);
  });
  return NextResponse.json(out);
});
