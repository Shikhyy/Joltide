import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { addDemoBot, cloneAsSandbox, ensureSeed, joinExperience } from "@/lib/runtime";
import { HttpError, getAggregate, saveAggregate } from "@/lib/store";

const Body = z.object({ userId: z.string().regex(USER_ID), name: z.string().min(1).max(32) });

/** "Try it solo": a private, unlisted copy with the labelled demo teammate already in the room. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "sandbox", 8, 10 * 60_000);
  const { id } = await ctx.params;
  const { userId, name } = Body.parse(await req.json());
  requirePlayer(req, userId);
  await ensureSeed();
  const src = await getAggregate(id);
  if (!src || src.exp.status === "DRAFT") throw new HttpError(404, "Experience not found");
  if (src.exp.startsAt && Date.now() < src.exp.startsAt) throw new HttpError(409, "This experience hasn't opened yet");
  const agg = cloneAsSandbox(src, { id: userId, name });
  await joinExperience(agg, userId, name, "solo-demo");
  await addDemoBot(agg);
  await saveAggregate(agg);
  return NextResponse.json({ id: agg.exp.id });
});
