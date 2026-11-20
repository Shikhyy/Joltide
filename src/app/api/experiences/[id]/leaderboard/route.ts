import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { leaderboard } from "@/lib/runtime";
import { getAggregate } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Fastest crews for an experience. Pass either the experience id or any of its run ids. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const agg = await getAggregate(id);
  const parent = agg?.exp.run?.parentId ?? id;
  return NextResponse.json({ parentId: parent, entries: await leaderboard(parent) });
});
