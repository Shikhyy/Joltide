import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { createCrewRun, ensureSeed, joinExperience } from "@/lib/runtime";
import { HttpError, getAggregate, saveAggregate } from "@/lib/store";

const Body = z.object({
  userId: z.string().regex(USER_ID),
  name: z.string().min(1).max(32),
  // shown publicly on the leaderboard, so keep it to plain characters
  crewName: z.string().trim().regex(/^[\p{L}\p{N} '\-!.]{2,32}$/u, "Crew names use letters, numbers and basic punctuation (2-32 characters)"),
  size: z.number().int().min(2).max(4),
});

/** Start a private crew run: a copy of the experience that only your crew joins, raced against the clock. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "crew", 10, 10 * 60_000);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  requirePlayer(req, b.userId);
  await ensureSeed();
  const src = await getAggregate(id);
  if (!src || src.exp.status === "DRAFT" || src.exp.sandbox || src.exp.run) throw new HttpError(404, "Experience not found");
  if (src.exp.startsAt && Date.now() < src.exp.startsAt) throw new HttpError(409, "This experience hasn't opened yet");
  const agg = createCrewRun(src, { id: b.userId, name: b.name }, b.crewName, b.size);
  await joinExperience(agg, b.userId, b.name, "crew");
  await saveAggregate(agg);
  return NextResponse.json({ id: agg.exp.id });
});
