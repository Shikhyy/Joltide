import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { issueBadge } from "@/lib/badge";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { HttpError, getAggregate } from "@/lib/store";

const Body = z.object({ userId: z.string().regex(USER_ID) });

/** A player who contributed to a completed (non-solo) experience can claim a verifiable badge. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "badge", 20, 10 * 60_000);
  const { id } = await ctx.params;
  const { userId } = Body.parse(await req.json());
  requirePlayer(req, userId);
  const agg = await getAggregate(id);
  if (!agg) throw new HttpError(404, "Not found");
  if (agg.exp.sandbox) throw new HttpError(409, "Solo demos don't earn badges");
  if (agg.exp.status !== "COMPLETED") throw new HttpError(409, "Finish the experience first");
  const member = agg.members.find((m) => m.userId === userId && !m.isBot);
  if (!member) throw new HttpError(403, "Only players can claim a badge");
  if (!agg.submissions.some((s) => s.userId === userId && s.correct)) throw new HttpError(403, "You need to have solved at least one mission");
  const token = issueBadge({ v: 1, e: agg.exp.id, t: agg.exp.title, n: member.name, a: Date.now(), s: agg.exp.stages.length, c: agg.exp.theme.accent });
  return NextResponse.json({ token, path: `/badge/${token}` });
});
