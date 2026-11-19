import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, USER_ID } from "@/lib/api";
import { issueToken, nexconnEnabled } from "@/lib/nexconn-server";
import { requirePlayer } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({ userId: z.string().regex(USER_ID), name: z.string().min(1).max(32) });

/** Issues a Nexconn access token for a user. The App Secret stays on the server. */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "session", 40, 60_000);
  const { userId, name } = Body.parse(await req.json());
  requirePlayer(req, userId);
  if (!nexconnEnabled) return NextResponse.json({ enabled: false });
  const token = await issueToken(userId, name);
  return NextResponse.json({
    enabled: true,
    token,
    appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY,
  });
});
