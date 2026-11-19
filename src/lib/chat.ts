"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperienceView } from "./types";
import type { Identity } from "./identity";

/**
 * Nexconn Chat SDK integration (Web).
 *  - group channel  = the experience's private team room
 *  - open channel   = the public live room (stream chat / spectators)
 *  - JT:Clue        = custom message: share a puzzle fragment with the room
 *  - JT:Event       = custom message pushed by OUR server when authoritative state changes
 * Chat never decides mission completion; the backend does.
 */

export const REACTIONS = ["🔥", "👏", "😮", "🧠", "❤️"] as const;
export type Channel = "group" | "live";
export interface ChatMsg {
  id: string;
  channel: Channel;
  kind: "text" | "clue" | "event";
  from: string;
  text: string;
  at: number;
}
export type ChatStatus = "off" | "connecting" | "online" | "error";

type Sdk = typeof import("@nexconn/chat");
let sdkPromise: Promise<Sdk> | null = null;
let initialized = false;
let connectedAs: string | null = null;

const loadSdk = () => (sdkPromise ??= import("@nexconn/chat"));

async function ensureConnected(identity: Identity): Promise<{ ok: boolean; reason?: string }> {
  const sdk = await loadSdk();
  const { NCEngine, AreaCode } = sdk;
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: identity.id, name: identity.name }),
  });
  const s = (await res.json()) as { enabled?: boolean; token?: string; appKey?: string; error?: string };
  if (!s.enabled || !s.token || !s.appKey) return { ok: false, reason: s.error ?? "Chat is not configured on this server" };
  if (!initialized) {
    NCEngine.initialize({
      appKey: s.appKey,
      areaCode: process.env.NEXT_PUBLIC_NEXCONN_AREA === "NA" ? AreaCode.NA : AreaCode.SG,
    });
    NCEngine.registerCustomMessages([
      { messageType: "JT:Clue", isPersisted: true, isCounted: true },
      { messageType: "JT:Event", isPersisted: true, isCounted: false },
      // live emoji reactions: ephemeral status messages, never stored or counted
      { messageType: "JT:React", isPersisted: false, isCounted: false, isStatusMessage: true },
    ]);
    initialized = true;
  }
  if (connectedAs === identity.id) return { ok: true };
  const r = await NCEngine.connect({ token: s.token });
  if (r.code !== 0) return { ok: false, reason: `Connect failed (code ${r.code})` };
  connectedAs = identity.id;
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(m: any, channel: Channel): ChatMsg | null {
  const type: string = m.messageType;
  const c = m.content ?? {};
  const base = { id: String(m.messageId ?? `${m.sentTime}-${Math.random()}`), channel, from: String(m.senderUserId ?? ""), at: Number(m.sentTime ?? Date.now()) };
  if (type === "RC:TxtMsg") return { ...base, kind: "text", text: String(c.text ?? c.content ?? "") };
  if (type === "JT:Clue") return { ...base, kind: "clue", text: String(c.text ?? "") };
  if (type === "JT:Event") {
    let p = c;
    if (typeof c === "string") {
      try {
        p = JSON.parse(c);
      } catch {
        p = {};
      }
    }
    const kind = p.kind as string;
    const text =
      kind === "stage_unlocked" ? `Stage unlocked: ${p.title}` : kind === "completed" ? `Experience complete: ${p.title}` : kind === "joined" ? `${p.name} joined the room` : "";
    return text ? { ...base, kind: "event", text } : null;
  }
  return null;
}

export function useRoom(
  view: ExperienceView | null,
  identity: Identity | null,
  onServerEvent: (kind: string) => void,
  hooks?: { onReact?: (emoji: string, from: string) => void; onIncoming?: () => void },
) {
  const [status, setStatus] = useState<ChatStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<ChatMsg[]>([]);
  const [live, setLive] = useState<ChatMsg[]>([]);
  const [watching, setWatching] = useState<number | null>(null);
  const cb = useRef(onServerEvent);
  const hk = useRef(hooks);
  useEffect(() => {
    cb.current = onServerEvent;
    hk.current = hooks;
  });

  const gid = view?.groupChannelId;
  const oid = view?.openChannelId;
  const joined = Boolean(view?.joined);
  const enabled = Boolean(view?.chatEnabled);
  const uid = identity?.id;
  const uname = identity?.name;

  useEffect(() => {
    if (!enabled || !joined || !gid || !oid || !uid || !uname) return;
    let dead = false;
    const hid = `jt-${gid}-${Math.random().toString(36).slice(2, 7)}`;
    setStatus("connecting");
    setError(null);
    (async () => {
      const sdk = await loadSdk();
      const { NCEngine, MessageHandler, ConnectionStatusHandler, OpenChannel, BaseChannel, GroupChannelIdentifier } = sdk;
      const push = (ch: Channel, list: ChatMsg[]) => {
        const set = ch === "group" ? setGroup : setLive;
        set((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          const merged = [...prev, ...list.filter((x) => !seen.has(x.id))];
          return merged.sort((a, b) => a.at - b.at).slice(-200);
        });
      };
      NCEngine.addMessageHandler(
        hid,
        new MessageHandler({
          onMessageReceived({ messages }) {
            for (const m of messages) {
              const ch: Channel | null = m.channelIdentifier.channelId === gid ? "group" : m.channelIdentifier.channelId === oid ? "live" : null;
              if (!ch) continue;
              if (m.messageType === "JT:React") {
                const emoji = String((m.content as { emoji?: string })?.emoji ?? "");
                if (ch === "group" && (REACTIONS as readonly string[]).includes(emoji)) hk.current?.onReact?.(emoji, m.senderUserId);
                continue;
              }
              const n = normalise(m, ch);
              if (n) push(ch, [n]);
              if (n && n.kind !== "event" && n.from !== uid) hk.current?.onIncoming?.();
              if (m.messageType === "JT:Event") {
                const c = m.content as { kind?: string };
                cb.current(c?.kind ?? "progress");
              }
            }
          },
        }),
      );
      NCEngine.addConnectionStatusHandler(
        hid,
        new ConnectionStatusHandler({
          onConnectionStatusChanged({ status: st }) {
            if (dead) return;
            if (st === 0) setStatus("online");
            else if (st === 1) setStatus("connecting");
          },
        }),
      );
      const c = await ensureConnected({ id: uid, name: uname });
      if (dead) return;
      if (!c.ok) {
        setStatus("error");
        setError(c.reason ?? "Could not connect");
        return;
      }
      setStatus("online");
      // history (group)
      try {
        const q = BaseChannel.createMessagesQuery({ channelIdentifier: new GroupChannelIdentifier(gid), pageSize: 40, isAscending: false });
        const r = await q.loadNextPage();
        if (!dead && r.isOk && r.data) push("group", r.data.data.map((m) => normalise(m, "group")).filter((x): x is ChatMsg => !!x));
      } catch {
        /* history is best-effort */
      }
      // live room
      try {
        const open = new OpenChannel(oid);
        const r = await open.enterChannel({ messageCount: 30 });
        if (!dead && r.isOk && r.data) setWatching(r.data.participantCount);
        const q = OpenChannel.createOpenChannelMessagesQuery({ channelId: oid, pageSize: 30, isAscending: false });
        const h = await q.loadNextPage();
        if (!dead && h.isOk && h.data) push("live", h.data.data.map((m) => normalise(m, "live")).filter((x): x is ChatMsg => !!x));
      } catch {
        /* optional */
      }
    })().catch((e) => {
      if (!dead) {
        setStatus("error");
        setError(String(e?.message ?? e));
      }
    });
    return () => {
      dead = true;
      loadSdk().then(({ NCEngine, OpenChannel }) => {
        NCEngine.removeMessageHandler(hid);
        NCEngine.removeConnectionStatusHandler(hid);
        new OpenChannel(oid).exitChannel().catch(() => {});
      });
    };
  }, [enabled, joined, gid, oid, uid, uname]);

  const send = useCallback(
    async (channel: Channel, text: string, kind: "text" | "clue" = "text") => {
      if (!gid || !oid) return false;
      const sdk = await loadSdk();
      const { GroupChannel, OpenChannel, SendTextMessageParams, SendMessageParams } = sdk;
      const target = channel === "group" ? new GroupChannel(gid) : new OpenChannel(oid);
      const params = kind === "clue" ? new SendMessageParams({ text }, "JT:Clue") : new SendTextMessageParams({ text });
      const r = await target.sendMessage(params);
      if (r.code === 0 && r.data) {
        const n = normalise(r.data, channel);
        if (n) (channel === "group" ? setGroup : setLive)((p) => (p.some((x) => x.id === n.id) ? p : [...p, n]));
        return true;
      }
      setError(`Send failed (code ${r.code})`);
      return false;
    },
    [gid, oid],
  );

  const react = useCallback(
    async (emoji: string) => {
      if (!gid) return false;
      const { GroupChannel, SendMessageParams } = await loadSdk();
      const r = await new GroupChannel(gid).sendMessage(new SendMessageParams({ emoji }, "JT:React"));
      return r.code === 0;
    },
    [gid],
  );

  return { status, error, group, live, watching, send, react };
}
