import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./store";

/**
 * Player identity without accounts.
 * The server mints a random public id and a private key = HMAC(secret, id).
 * Ids are visible to everyone (player list, chat). The key never is, so knowing
 * an id is not enough to act as that player.
 */
const secret = () =>
  process.env.IDENTITY_SECRET ||
  (process.env.NEXCONN_APP_SECRET ? createHash("sha256").update(`joltide-identity:${process.env.NEXCONN_APP_SECRET}`).digest("hex") : "dev-only-identity-secret");

export const signId = (id: string) => createHmac("sha256", secret()).update(id).digest("base64url");

export function mintIdentity() {
  const id = `u${randomBytes(10).toString("hex")}`;
  return { id, key: signId(id) };
}

export function keyMatches(userId: string, key: string | null | undefined): boolean {
  if (!key) return false;
  const a = Buffer.from(signId(userId));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const KEY_HEADER = "x-player-key";

/** True when the request carries the valid key for this player id. */
export const isPlayer = (req: Request, userId: string) => keyMatches(userId, req.headers.get(KEY_HEADER));

/** Throws 401 unless the request proves it belongs to this player. */
export function requirePlayer(req: Request, userId: string) {
  if (!isPlayer(req, userId)) throw new HttpError(401, "invalid_player");
}
