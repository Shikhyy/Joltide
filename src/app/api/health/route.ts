import { NextResponse } from "next/server";
import { nexconnEnabled } from "@/lib/nexconn-server";

export const dynamic = "force-dynamic";

/** Configuration status only. Never returns secrets. */
export function GET() {
  const redis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return NextResponse.json({
    ok: true,
    nexconn: nexconnEnabled,
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    persistence: redis ? "redis" : process.env.VERCEL ? "ephemeral (set Upstash env vars!)" : "file",
  });
}
