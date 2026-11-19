import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { CreateBody, buildStages } from "@/lib/schemas";
import { HttpError, getAggregate, withAggregate } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Creator-only: read the full editable draft (includes answers). */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const agg = await getAggregate(id);
  if (!agg) throw new HttpError(404, "Not found");
  if (req.headers.get("x-creator-key") !== agg.exp.creatorKey) throw new HttpError(403, "Creator access only");
  const e = agg.exp;
  return NextResponse.json({
    id: e.id,
    status: e.status,
    title: e.title,
    tagline: e.tagline,
    description: e.description,
    theme: e.theme,
    streamUrl: e.streamUrl ?? "",
    startsAt: e.startsAt ?? null,
    stages: e.stages.map((s) => ({
      title: s.title,
      story: s.story,
      threshold: s.threshold,
      missions: s.missions.map((m) => ({
        type: m.type,
        title: m.title,
        prompt: m.prompt,
        answer: m.answer ?? "",
        shards: m.shards ?? [],
        options: m.options ?? [],
        hint: m.hint ?? "",
      })),
    })),
  });
});

/** Creator-only: update a draft before it goes live. */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = CreateBody.parse(await req.json());
  const out = await withAggregate(id, (agg) => {
    if (req.headers.get("x-creator-key") !== agg.exp.creatorKey) throw new HttpError(403, "Creator access only");
    if (agg.exp.status !== "DRAFT") throw new HttpError(409, "Live experiences can't be edited");
    Object.assign(agg.exp, {
      title: b.title,
      tagline: b.tagline,
      description: b.description,
      theme: b.theme,
      streamUrl: b.streamUrl || undefined,
      startsAt: b.startsAt,
      stages: buildStages(b.stages, agg.exp.stages),
    });
    return { id: agg.exp.id };
  });
  return NextResponse.json(out);
});
