import { HttpError } from "./store";

/**
 * Small in-memory sliding-window limiter, keyed by client IP + bucket.
 * Protects AI spend and Nexconn quota. (Per server instance; fine for a launch,
 * swap for Upstash ratelimit if you scale out.)
 */
const hits = new Map<string, number[]>();

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(req: Request, bucket: string, limit: number, windowMs: number) {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    throw new HttpError(429, "Too many requests. Please slow down and try again shortly.");
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}
