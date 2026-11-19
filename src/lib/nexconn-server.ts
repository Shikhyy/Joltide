import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Server-side Nexconn Platform Chat API client.
 * The App Secret never leaves this file / the server environment.
 * Signature = sha1(AppSecret + Nonce + Timestamp)  (see docs: API request signature)
 */

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
const APP_SECRET = process.env.NEXCONN_APP_SECRET;
const HOSTS = [
  process.env.NEXCONN_API_HOST ?? "api.sg-light-api.com",
  (process.env.NEXCONN_API_HOST ?? "api.sg-light-api.com").replace("api.", "api-b."),
];

export const SYSTEM_USER_ID = "joltide";
export const nexconnEnabled = Boolean(APP_KEY && APP_SECRET);

export class NexconnError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

async function call<T = Record<string, unknown>>(
  pathname: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!nexconnEnabled) throw new NexconnError("Nexconn is not configured");
  let lastErr: unknown;
  for (const host of HOSTS) {
    const nonce = randomBytes(8).toString("hex").slice(0, 16);
    const timestamp = String(Date.now());
    const signature = createHash("sha1")
      .update(APP_SECRET + nonce + timestamp)
      .digest("hex");
    try {
      const res = await fetch(`https://${host}${pathname}`, {
        method: "POST",
        headers: {
          "App-Key": APP_KEY!,
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
      // Nexconn replies {"code":0,...} on success and {"code":<n>,"errorMessage":...} on failure.
      const code = typeof json.code === "number" ? json.code : res.ok ? 0 : res.status;
      if (code !== 0 && code !== 200) throw new NexconnError(String(json.errorMessage ?? json.msg ?? json.message ?? text).slice(0, 200), code);
      return json as T;
    } catch (e) {
      if (e instanceof NexconnError) throw e; // real API error: don't fail over
      lastErr = e; // network/5xx → try backup domain
    }
  }
  throw new NexconnError(`Nexconn unreachable: ${(lastErr as Error)?.message ?? "unknown"}`);
}

export async function issueToken(userId: string, name: string, avatarUrl?: string) {
  const r = await call<{ result?: { accessToken?: string }; token?: string }>("/v4/auth/access-token/issue", {
    userId,
    name: name.slice(0, 64),
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  const token = r.result?.accessToken ?? r.token;
  if (!token) throw new NexconnError("Nexconn returned no access token");
  return token;
}

export async function createGroup(channelId: string, name: string, introduction: string) {
  await issueToken(SYSTEM_USER_ID, "JOLTIDE");
  try {
    await call("/v4/group-channel/create", {
      channelId,
      name: name.slice(0, 64),
      owner: SYSTEM_USER_ID,
      groupProfile: { introduction: introduction.slice(0, 500) },
    });
  } catch (e) {
    // idempotent: ignore "already exists"
    if (!(e instanceof NexconnError)) throw e;
    if (!/exist/i.test(e.message)) throw e;
  }
}

export async function joinGroup(channelId: string, userIds: string[]) {
  await call("/v4/group-channel/join", { channelId, userIds });
}

export async function createOpenChannel(channelId: string) {
  try {
    await call("/v4/open-channel/create", { channelId, destroyType: 1, ttlMinutes: 60 * 24 * 7 });
  } catch (e) {
    if (!(e instanceof NexconnError)) throw e;
    if (!/exist/i.test(e.message)) throw e;
  }
}

/** Custom message type registered on the client. Server pushes authoritative state events. */
export const EVENT_MESSAGE_TYPE = "JT:Event";

export async function pushEvent(
  groupId: string | undefined,
  openId: string | undefined,
  payload: Record<string, unknown>,
) {
  const content = JSON.stringify(payload);
  const jobs: Promise<unknown>[] = [];
  if (groupId)
    jobs.push(
      call("/v4/group-channel/message/send", {
        fromUserId: SYSTEM_USER_ID,
        toChannelIds: [groupId],
        messageType: EVENT_MESSAGE_TYPE,
        content,
        isEchoToSender: 0,
      }),
    );
  if (openId)
    jobs.push(
      call("/v4/open-channel/message/send", {
        fromUserId: SYSTEM_USER_ID,
        toChannelIds: [openId],
        messageType: EVENT_MESSAGE_TYPE,
        content,
      }),
    );
  await Promise.allSettled(jobs);
}

export async function sendGroupText(groupId: string, fromUserId: string, text: string) {
  await call("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [groupId],
    messageType: "RC:TxtMsg",
    content: JSON.stringify({ content: text }),
    isEchoToSender: 0,
  });
}

export async function sendOpenText(openId: string, fromUserId: string, text: string) {
  await call("/v4/open-channel/message/send", {
    fromUserId,
    toChannelIds: [openId],
    messageType: "RC:TxtMsg",
    content: JSON.stringify({ content: text }),
  });
}
