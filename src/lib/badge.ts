import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifiable completion badges: a signed credential, no wallet or chain needed.
 * token = base64url(payload JSON) + "." + base64url(HMAC-SHA256)
 * Anyone can verify it at /badge/<token>; nobody can forge one without the server secret.
 */
export interface BadgePayload {
  v: 1;
  e: string; // experience id
  t: string; // experience title
  n: string; // player display name
  a: number; // completion time (ms)
  s: number; // stages
  c: string; // accent color
}

const secret = () =>
  process.env.BADGE_SECRET ||
  (process.env.NEXCONN_APP_SECRET ? createHash("sha256").update(`joltide-badge:${process.env.NEXCONN_APP_SECRET}`).digest("hex") : "dev-only-badge-secret");

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest();

export function issueBadge(p: BadgePayload): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${b64(sign(body))}`;
}

export function verifyBadge(token: string): BadgePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = sign(body);
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BadgePayload;
    return p.v === 1 && typeof p.e === "string" && typeof p.t === "string" && typeof p.n === "string" ? p : null;
  } catch {
    return null;
  }
}
