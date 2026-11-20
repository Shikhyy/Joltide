import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, withAggregate } from "@/lib/store";

const Body = z.object({ listed: z.boolean() });

/** Creator-only: opt this experience in or out of the public template marketplace. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { listed } = Body.parse(await req.json());
  const out = await withAggregate(id, (agg) => {
    if (req.headers.get("x-creator-key") !== agg.exp.creatorKey) throw new HttpError(403, "Creator access only");
    if (agg.exp.sandbox || agg.exp.run) throw new HttpError(409, "Solo demos and crew runs can't be listed");
    if (agg.exp.status === "DRAFT") throw new HttpError(409, "Publish it first");
    agg.exp.listedAsTemplate = listed;
    return { listed, remixes: agg.exp.remixCount ?? 0 };
  });
  return NextResponse.json(out);
});
