import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { CreateBody, buildStages } from "@/lib/schemas";
import { listCards, newAggregate, publish } from "@/lib/runtime";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";
import { saveAggregate } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => NextResponse.json({ experiences: await listCards() }));

export const POST = handle(async (req: Request) => {
  rateLimit(req, "create", 12, 10 * 60_000);
  const b = CreateBody.parse(await req.json());
  requirePlayer(req, b.userId);
  const stages = buildStages(b.stages);
  const agg = newAggregate(
    {
      title: b.title,
      tagline: b.tagline,
      description: b.description,
      theme: b.theme,
      stages,
      source: b.source,
      streamUrl: b.streamUrl || undefined,
      clonedFrom: b.clonedFrom,
      startsAt: b.startsAt,
    },
    { id: b.userId, name: b.userName },
  );
  if (b.publish) await publish(agg);
  await saveAggregate(agg);
  return NextResponse.json({ id: agg.exp.id, creatorKey: agg.exp.creatorKey, status: agg.exp.status });
});
