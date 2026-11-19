"use client";
import { Radio, SendHorizontal, Sparkles, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { REACTIONS, type Channel, type ChatMsg, type ChatStatus } from "@/lib/chat";
import type { ExperienceView } from "@/lib/types";

function embedFor(url: string | undefined): { src: string; title: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return { src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`, title: "YouTube stream" };
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return id ? { src: `https://www.youtube-nocookie.com/embed/${id}`, title: "YouTube stream" } : null;
    }
    if (host.endsWith("twitch.tv")) {
      const ch = u.pathname.split("/").filter(Boolean)[0];
      return ch ? { src: `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${location.hostname}&muted=true`, title: "Twitch stream" } : null;
    }
  } catch {}
  return null;
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

export default function ChatPanel({
  view,
  meId,
  status,
  error,
  group,
  live,
  watching,
  send,
  onReact,
}: {
  view: ExperienceView;
  meId: string | undefined;
  status: ChatStatus;
  error: string | null;
  group: ChatMsg[];
  live: ChatMsg[];
  watching: number | null;
  send: (c: Channel, text: string, kind?: "text" | "clue") => Promise<boolean>;
  onReact?: (emoji: string) => void;
}) {
  const [tab, setTab] = useState<Channel>("group");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);
  const [recapBusy, setRecapBusy] = useState(false);
  const list = tab === "group" ? group : live;
  const end = useRef<HTMLDivElement>(null);
  const embed = tab === "live" ? embedFor(view.streamUrl) : null;
  const names = new Map(view.members.map((m) => [m.userId, m]));

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [list.length, tab]);

  const catchUp = async () => {
    setRecapBusy(true);
    try {
      const r = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: view.title,
          messages: list
            .filter((m) => m.kind !== "event")
            .slice(-40)
            .map((m) => ({ who: names.get(m.from)?.name ?? "player", text: m.text.slice(0, 300) })),
        }),
      });
      const j = await r.json();
      setRecap(r.ok ? j.summary : j.error ?? "Couldn't summarise right now.");
    } finally {
      setRecapBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await send(tab, t);
    if (ok) setText("");
    setBusy(false);
  };

  const dot = status === "online" ? "bg-ok" : status === "connecting" ? "bg-warn blink" : "bg-bad";
  const label = status === "online" ? "Nexconn live" : status === "connecting" ? "Connecting" : status === "error" ? "Offline" : "Idle";

  return (
    <section className="sheet flex h-full min-h-[460px] flex-col overflow-hidden" aria-label="Nexconn chat">
      <header className="flex items-center justify-between border-b border-line px-4">
        <div role="tablist" className="flex">
          {(["group", "live"] as const).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={`mono relative px-1 py-3.5 pr-5 text-[11px] uppercase tracking-[0.14em] transition-colors ${tab === c ? "text-ink" : "text-faint hover:text-dim"}`}
            >
              {c === "group" ? "Team room" : "Live room"}
              {tab === c && <span className="absolute inset-x-0 bottom-0 mr-5 h-0.5 bg-[var(--accent)]" />}
            </button>
          ))}
        </div>
        <span className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-faint">
          <Radio size={12} />
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
          {tab === "live" && watching != null && <span>· {watching}</span>}
        </span>
      </header>

      {embed && (
        <div className="aspect-video w-full shrink-0 border-b border-line bg-black">
          <iframe src={embed.src} title={embed.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}

      {(list.filter((m) => m.kind !== "event").length >= 4 || recap) && view.joined && (
        <div className="border-b border-line px-4 py-2.5">
          {recap ? (
            <div className="relative border-l-2 border-[var(--accent)] bg-white/[0.03] py-2 pl-3 pr-8 text-[13px] leading-relaxed text-dim">
              <div className="mono mb-1 text-[9px] uppercase tracking-[0.18em] text-[var(--accent)]">AI recap</div>
              <p className="whitespace-pre-line">{recap}</p>
              <button className="absolute right-2 top-2 text-faint hover:text-ink" onClick={() => setRecap(null)} aria-label="Dismiss recap">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-dim hover:text-ink" onClick={catchUp} disabled={recapBusy}>
              <Sparkles size={13} className="text-[var(--accent)]" /> {recapBusy ? "Reading the room…" : "Catch me up"}
            </button>
          )}
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {!view.chatEnabled ? (
          <Notice title="Chat isn't configured on this server" body="Add the Nexconn App Key and Secret to enable rooms." />
        ) : !view.joined ? (
          <Notice title="Join to enter the room" body="Chat opens as soon as you join this experience." />
        ) : error ? (
          <Notice title="Chat problem" body={error} tone="bad" />
        ) : list.length === 0 ? (
          <Notice
            title={tab === "group" ? "Say hi to your team" : "The live room is quiet"}
            body={tab === "group" ? "Each player holds different clues. Share what you find." : "Anyone watching can chat here, even before joining."}
          />
        ) : (
          list.map((m) => {
            const mine = m.from === meId;
            const who = mine ? "you" : names.get(m.from)?.name ?? (m.from === "joltide" ? "joltide" : "player");
            if (m.kind === "event")
              return (
                <div key={m.id} className="mono flex items-center gap-2 border-y border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                  <Zap size={12} fill="currentColor" /> {m.text}
                </div>
              );
            return (
              <div key={m.id} className="text-[13.5px] leading-snug">
                <span className="mono mr-2 text-[10px] text-faint">{hhmm(m.at)}</span>
                <span className="mono mr-2 text-[11px] font-semibold uppercase" style={{ color: mine ? "var(--ink)" : names.get(m.from)?.color }}>
                  {who}
                </span>
                <span className={m.kind === "clue" ? "border-l-2 border-warn bg-warn/10 px-2 py-0.5 text-warn" : mine ? "text-ink" : "text-dim"}>
                  {m.kind === "clue" && <span className="mono mr-2 text-[9px] font-bold uppercase tracking-widest">clue</span>}
                  {m.text}
                </span>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>

      {onReact && view.joined && status === "online" && tab === "group" && (
        <div className="flex items-center gap-1 border-t border-line px-3 py-2" role="group" aria-label="Send a reaction to your team">
          <span className="mono mr-1 text-[9px] uppercase tracking-[0.16em] text-faint">React</span>
          {REACTIONS.map((e) => (
            <button key={e} className="grid h-8 w-8 place-items-center text-base transition-transform hover:scale-125 active:scale-90" onClick={() => onReact(e)} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
        <input
          className="input !min-h-[40px] !border-transparent !bg-white/[0.04]"
          placeholder={view.joined && status === "online" ? (tab === "group" ? "Message your team" : "Message the live room") : "Chat unavailable"}
          value={text}
          maxLength={300}
          disabled={!view.joined || status !== "online"}
          onChange={(e) => setText(e.target.value)}
          aria-label="Message"
        />
        <button className="btn btn-primary !min-h-[40px] !px-3" disabled={!text.trim() || busy || status !== "online"} aria-label="Send">
          <SendHorizontal size={17} />
        </button>
      </form>
    </section>
  );
}

function Notice({ title, body, tone }: { title: string; body: string; tone?: "bad" }) {
  return (
    <div className="grid h-full place-items-center px-4 py-10 text-center">
      <div>
        <div className={`mono text-[11px] uppercase tracking-[0.14em] ${tone === "bad" ? "text-bad" : "text-dim"}`}>{title}</div>
        <p className="mt-2 text-xs text-faint">{body}</p>
      </div>
    </div>
  );
}
