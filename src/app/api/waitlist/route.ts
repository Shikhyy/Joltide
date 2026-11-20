import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { addWaitlist, waitlistCount } from "@/lib/store";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  plan: z.enum(["pro", "studio"]),
  note: z.string().trim().max(200).optional(),
});

/** Creator Pro / Studio interest list. Returns only the public count, never any email. */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "waitlist", 6, 10 * 60_000);
  const b = Body.parse(await req.json());
  const isNew = await addWaitlist({ ...b, at: Date.now() });
  return NextResponse.json({ ok: true, alreadyJoined: !isNew, count: await waitlistCount() });
});
