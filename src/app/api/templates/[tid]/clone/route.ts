import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { newAggregate } from "@/lib/runtime";
import { HttpError, getAggregate, saveAggregate, withAggregate } from "@/lib/store";
import { TEMPLATES, mission, stage } from "@/lib/templates";
import type { Stage, Theme } from "@/lib/types";

const Body = z.object({ userId: z.string().regex(USER_ID), name: z.string().min(1).max(32) });

const copyStages = (stages: Stage[]) => stages.map((s) => stage({ ...s, missions: s.missions.map((m) => mission({ ...m })) }));

/** Remix: clone a built-in or creator-listed template into the caller's own editable draft. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ tid: string }> }) => {
  rateLimit(req, "remix", 20, 10 * 60_000);
  const { tid } = await ctx.params;
  const { userId, name } = Body.parse(await req.json());
  requirePlayer(req, userId);
  let src: { title: string; tagline: string; description: string; theme: Theme; stages: Stage[] };
  const builtin = TEMPLATES.find((x) => x.id === tid);
  if (builtin) src = builtin;
  else {
    const a = await getAggregate(tid);
    if (!a || !a.exp.listedAsTemplate || a.exp.sandbox || a.exp.status === "DRAFT") throw new HttpError(404, "Template not found");
    src = a.exp;
    await withAggregate(tid, (agg) => {
      agg.exp.remixCount = (agg.exp.remixCount ?? 0) + 1;
    });
  }
  const agg = newAggregate(
    { title: src.title, tagline: src.tagline, description: src.description, theme: src.theme, stages: copyStages(src.stages), source: "template", clonedFrom: tid },
    { id: userId, name },
  );
  await saveAggregate(agg);
  return NextResponse.json({ id: agg.exp.id, creatorKey: agg.exp.creatorKey });
});
