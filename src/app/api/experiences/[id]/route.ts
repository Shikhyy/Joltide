import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { isPlayer } from "@/lib/player";
import { ensureSeed, view } from "@/lib/runtime";
import { getAggregate, withAggregate } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await ensureSeed();
  const asked = new URL(req.url).searchParams.get("userId") ?? undefined;
  // someone else's id without their key gets the anonymous view (no private fragments, no presence)
  const userId = asked && isPlayer(req, asked) ? asked : undefined;
  let agg = await getAggregate(id);
  if (!agg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = userId ? agg.members.find((m) => m.userId === userId) : undefined;
  if (me && Date.now() - me.lastSeen > 10_000) {
    // presence heartbeat (throttled)
    agg = await withAggregate(id, (a) => {
      const m = a.members.find((x) => x.userId === userId);
      if (m) m.lastSeen = Date.now();
      return a;
    });
  }
  // drafts are only visible to their creator (key in header); others see 404
  if (agg.exp.status === "DRAFT" && req.headers.get("x-creator-key") !== agg.exp.creatorKey)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view(agg, userId));
});
