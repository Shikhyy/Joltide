import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { requirePlayer } from "@/lib/player";
import { submit, view } from "@/lib/runtime";
import { withAggregate } from "@/lib/store";

const Body = z.object({
  userId: z.string().regex(USER_ID),
  missionId: z.string().min(1).max(40),
  content: z.string().min(1).max(200),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  requirePlayer(req, b.userId);
  const out = await withAggregate(id, async (agg) => {
    const result = await submit(agg, b.userId, b.missionId, b.content);
    return { result, view: view(agg, b.userId) };
  });
  return NextResponse.json(out);
});
