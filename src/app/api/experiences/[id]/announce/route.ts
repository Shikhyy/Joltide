import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import * as nx from "@/lib/nexconn-server";
import { HttpError, withAggregate } from "@/lib/store";

const Body = z.object({ text: z.string().trim().min(1).max(280) });

/** Creator-only: broadcast a message to both Nexconn rooms as "JOLTIDE". */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "announce", 20, 10 * 60_000);
  const { id } = await ctx.params;
  const { text } = Body.parse(await req.json());
  const out = await withAggregate(id, async (agg) => {
    if (req.headers.get("x-creator-key") !== agg.exp.creatorKey) throw new HttpError(403, "Creator access only");
    if (!nx.nexconnEnabled || !agg.exp.groupChannelId || !agg.exp.openChannelId) throw new HttpError(409, "Chat rooms aren't available for this experience yet");
    const msg = `${agg.exp.creatorName}: ${text}`;
    await nx.sendGroupText(agg.exp.groupChannelId, nx.SYSTEM_USER_ID, msg);
    await nx.sendOpenText(agg.exp.openChannelId, nx.SYSTEM_USER_ID, msg);
    agg.events.push({ id: Math.random().toString(36).slice(2, 8), at: Date.now(), type: "announcement", text: `Announcement: ${text}` });
    return { sent: true };
  });
  return NextResponse.json(out);
});
