import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { generateExperience } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;
const Body = z.object({ prompt: z.string().min(8).max(600) });

export const POST = handle(async (req: Request) => {
  rateLimit(req, "generate", 6, 10 * 60_000); // each call spends AI credits
  const { prompt } = Body.parse(await req.json());
  return NextResponse.json(await generateExperience(prompt));
});
