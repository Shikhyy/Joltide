import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { mintIdentity } from "@/lib/player";
import { rateLimit } from "@/lib/ratelimit";

/** Mint a new anonymous player identity (public id + private key). */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "identity", 20, 60_000);
  return NextResponse.json(mintIdentity());
});
