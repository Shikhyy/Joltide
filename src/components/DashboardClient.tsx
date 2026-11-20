"use client";
import { animate, motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, KeyRound, Megaphone, MonitorPlay, Pencil, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCreatorKey, setCreatorKey } from "@/lib/identity";

interface Data {
  title: string;
  tagline: string;
  participants: number;
  activeNow: number;
  submissions: number;
  correctRate: number;
  status: string;
  currentStage: number;
  totalMissions: number;
  funnel: { stage: string; threshold: number; finished: number; reached: boolean }[];
  votes: Record<string, Record<string, number>>;
  events: { id: string; at: number; text: string }[];
  members: { userId: string; name: string; color: string; joinedAt: number; completed: number }[];
  chat: { groupChannelId: string | null; openChannelId: string | null };
  sources: { ref: string; count: number }[];
  listed: boolean;
  remixes: number;
  startsAt: number | null;
  scheduled?: boolean;
}

export default function DashboardClient({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | string>("idle");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (k: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(null), 1600);
  };
  const toggleListing = async () => {
    if (!d) return;
    await fetch(`/api/experiences/${id}/list-template`, { method: "POST", headers: { "content-type": "application/json", "x-creator-key": getCreatorKey(id) ?? "" }, body: JSON.stringify({ listed: !d.listed }) });
    load();
  };
  const announce = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendState("sending");
    const r = await fetch(`/api/experiences/${id}/announce`, { method: "POST", headers: { "content-type": "application/json", "x-creator-key": getCreatorKey(id) ?? "" }, body: JSON.stringify({ text: note }) });
    const j = await r.json();
    if (r.ok) {
      setNote("");
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 2500);
    } else setSendState(j.error ?? "Failed");
  };

  const load = useCallback(async () => {
    const hash = new URLSearchParams(location.hash.slice(1)).get("key");
    if (hash) {
      setCreatorKey(id, hash); // restore access from a backup link
      history.replaceState(null, "", location.pathname);
    }
    const key = getCreatorKey(id);
    if (!key) return setErr("This browser doesn't hold the creator key for this experience.");
    const r = await fetch(`/api/experiences/${id}/analytics`, { headers: { "x-creator-key": key }, cache: "no-store" });
    const j = await r.json();
    if (!r.ok) return setErr(j.error ?? "Failed to load");
    setD({ ...j, scheduled: typeof j.startsAt === "number" && j.startsAt > Date.now() });
  }, [id]);

  useEffect(() => {
    setOrigin(location.origin);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (err)
    return (
      <div className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="display text-5xl font-bold uppercase leading-[0.9]">No access</h1>
        <p className="mt-3 text-sm text-dim">{err}</p>
        <Link href="/studio" className="btn mt-8">
          Back to Studio
        </Link>
      </div>
    );
  if (!d) return <div className="mono grid min-h-[50vh] place-items-center text-[11px] uppercase tracking-[0.16em] text-faint">Loading dashboard…</div>;

  const link = `${origin}/e/${id}`;
  const status = d.status === "DRAFT" ? "Draft" : d.status === "COMPLETED" ? "Completed" : d.scheduled ? "Scheduled" : "Live";
  const kpis: { label: string; value: number | string; sub?: string }[] = [
    { label: "Participants", value: d.participants },
    { label: "Online now", value: d.activeNow },
    { label: "Submissions", value: d.submissions, sub: `${d.correctRate}% correct` },
    { label: "Stage", value: d.status === "COMPLETED" ? "Done" : `${Math.min(d.currentStage + 1, d.funnel.length)}/${d.funnel.length}` },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <div className="mono flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-faint">
        <span className="flex items-center gap-2 text-signal">
          <span className="blink h-1.5 w-1.5 rounded-full bg-current" /> {status}
        </span>
        <span className="h-px w-10 bg-line-strong" />
        Creator dashboard
        <span className="hidden sm:inline">· refreshes every 4s</span>
        {d.scheduled && d.startsAt && <span className="text-dim">· opens {new Date(d.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <h1 className="display text-5xl font-extrabold uppercase leading-[0.88] sm:text-7xl">{d.title}</h1>
        <div className="flex flex-wrap gap-3">
          {d.status === "DRAFT" ? (
            <Link href={`/studio?edit=${id}`} className="btn btn-primary">
              <Pencil size={15} /> Edit and publish
            </Link>
          ) : (
            <Link href={`/e/${id}`} className="btn btn-primary">
              Open experience <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>

      {d.status !== "DRAFT" && (
        <div className="mt-8 flex max-w-2xl items-center border border-line-strong bg-panel">
          <span className="mono hidden px-4 text-[10px] uppercase tracking-[0.16em] text-faint sm:block">Share</span>
          <input readOnly value={link} aria-label="Share link" className="mono min-w-0 flex-1 bg-transparent px-4 py-3 text-[13px] text-dim outline-none" onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn !min-h-[46px] !rounded-none !border-0 !border-l !border-line-strong"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {d.status !== "DRAFT" && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="label !mb-0 mr-2">Tracked links</span>
          {["discord", "x", "youtube", "twitch", "reddit"].map((s) => (
            <button key={s} className="btn btn-sm" onClick={() => copy(s, `${link}?ref=${s}`)}>
              {copiedKey === s ? <Check size={13} /> : <Copy size={13} />} {s}
            </button>
          ))}
          <button className="btn btn-sm" onClick={() => copy("overlay", `${origin}/overlay/${id}`)} title="Add as a Browser Source in OBS (about 520 x 220). Transparent background.">
            {copiedKey === "overlay" ? <Check size={13} /> : <MonitorPlay size={13} />} Copy OBS overlay URL
          </button>
          <button className="btn btn-sm ml-auto" onClick={() => copy("backup", `${origin}/studio/${id}#key=${getCreatorKey(id) ?? ""}`)} title="Anyone with this link can manage this experience. Keep it private.">
            {copiedKey === "backup" ? <Check size={13} /> : <KeyRound size={13} />} Copy private backup link
          </button>
        </div>
      )}

      <div className="mt-12 grid grid-cols-2 border-y border-line lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={`px-1 py-7 sm:px-6 ${i > 0 ? "lg:border-l lg:border-line" : ""} ${i % 2 === 1 ? "border-l border-line lg:border-l" : ""}`}>
            <div className="label !mb-3">{k.label}</div>
            <div className="display text-6xl font-extrabold leading-none sm:text-7xl">{typeof k.value === "number" ? <CountUp to={k.value} /> : k.value}</div>
            {k.sub && <div className="mono mt-2 text-[10px] uppercase tracking-[0.14em] text-faint">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-2">
        <section aria-labelledby="funnel">
          <h2 id="funnel" className="display text-3xl font-bold uppercase">
            Stage funnel
          </h2>
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">Players finished vs. unlock threshold</p>
          <ul className="mt-6 border-t border-line">
            {d.funnel.map((f, i) => {
              const pct = f.threshold ? Math.min(100, Math.round((f.finished / f.threshold) * 100)) : 0;
              return (
                <li key={i} className="grid grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-line py-4">
                  <span className="mono text-[11px] tracking-[0.12em] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className={`truncate text-sm font-semibold ${f.reached ? "" : "text-faint"}`}>{f.stage}</div>
                    <div className="mt-2 h-1.5 bg-line">
                      <motion.div className="h-full bg-signal" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} />
                    </div>
                  </div>
                  <span className="mono text-xs text-dim">
                    {f.finished}/{f.threshold}
                  </span>
                </li>
              );
            })}
          </ul>
          {Object.entries(d.votes).map(([title, opts]) => {
            const total = Object.values(opts).reduce((a, b) => a + b, 0);
            return (
              <div key={title} className="mt-8">
                <div className="label">Vote · {title}</div>
                {Object.entries(opts).map(([o, n]) => (
                  <div key={o} className="mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-dim">{o}</span>
                      <span className="mono text-xs text-faint">{n}</span>
                    </div>
                    <div className="mt-1 h-1 bg-line">
                      <motion.div className="h-full bg-ink/70" initial={{ width: 0 }} animate={{ width: `${total ? (n / total) * 100 : 0}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <section aria-labelledby="players">
          <h2 id="players" className="display text-3xl font-bold uppercase">
            Participants
          </h2>
          <ul className="mt-6 border-t border-line">
            {d.members.length === 0 && <li className="border-b border-line py-6 text-sm text-dim">No one has joined yet. Share your link.</li>}
            {d.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-4 border-b border-line py-3.5 text-sm">
                <span className="h-2 w-2" style={{ background: m.color }} />
                <span className="font-semibold">{m.name}</span>
                <span className="mono ml-auto text-[11px] text-dim">
                  {m.completed}/{d.totalMissions} missions
                </span>
                <span className="hidden w-20 sm:block">
                  <span className="block h-1 bg-line">
                    <span className="block h-full bg-signal" style={{ width: `${d.totalMissions ? (m.completed / d.totalMissions) * 100 : 0}%` }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="timeline">
          <h2 id="timeline" className="display text-3xl font-bold uppercase">
            Timeline
          </h2>
          <ol className="relative mt-6 space-y-5 border-l border-line-strong pl-6">
            {d.events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[29px] top-1.5 h-2 w-2 bg-signal" />
                <time className="mono text-[10px] uppercase tracking-[0.14em] text-faint">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                <p className="text-sm text-dim">{e.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {d.status !== "DRAFT" && (
          <section aria-labelledby="broadcast">
            <h2 id="broadcast" className="display text-3xl font-bold uppercase">
              Broadcast
            </h2>
            <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">Posts to both Nexconn rooms, signed with your name</p>
            <form onSubmit={announce} className="mt-6 flex gap-2">
              <input className="input" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="Going live in 5 minutes, stage 3 opens tonight" aria-label="Announcement" />
              <button className="btn btn-primary" disabled={!note.trim() || sendState === "sending"}>
                <Megaphone size={15} /> {sendState === "sending" ? "…" : "Send"}
              </button>
            </form>
            <p role="status" className={`mt-2 text-xs ${sendState === "sent" ? "text-ok" : "text-bad"}`}>
              {sendState === "sent" ? "Sent to both rooms." : sendState !== "idle" && sendState !== "sending" ? sendState : ""}
            </p>
            <div className="mt-8">
              <div className="label">Where players come from</div>
              <ul className="border-t border-line text-sm">
                {d.sources.length === 0 && <li className="border-b border-line py-3 text-dim">No joins yet.</li>}
                {d.sources.map((s) => (
                  <li key={s.ref} className="flex justify-between border-b border-line py-2.5">
                    <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">{s.ref}</span>
                    <span className="mono text-xs">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {d.status !== "DRAFT" && (
          <section aria-labelledby="market">
            <h2 id="market" className="display text-3xl font-bold uppercase">
              Marketplace
            </h2>
            <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">Let other creators remix this experience</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button className="btn" onClick={toggleListing}>
                <Store size={15} /> {d.listed ? "Remove from marketplace" : "List as template"}
              </button>
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">{d.listed ? `Listed · remixed ${d.remixes}×` : "Not listed"}</span>
            </div>
            <p className="mt-3 max-w-md text-xs text-faint">Listing shares your puzzles <strong className="text-dim">and their answers</strong> with anyone who remixes it. You can remove it at any time.</p>
          </section>
        )}

        <section aria-labelledby="rooms">
          <h2 id="rooms" className="display text-3xl font-bold uppercase">
            Nexconn rooms
          </h2>
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">Created automatically on publish</p>
          <dl className="mt-6 border-t border-line text-sm">
            {[
              ["Team group channel", d.chat.groupChannelId],
              ["Live open channel", d.chat.openChannelId],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-4 border-b border-line py-4">
                <dt className="text-dim">{k}</dt>
                <dd className="mono text-xs">{v ?? <span className="text-faint">not created</span>}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const c = animate(from.current, to, { duration: 0.9, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(Math.round(x)) });
    from.current = to;
    return () => c.stop();
  }, [to]);
  return <>{v}</>;
}
