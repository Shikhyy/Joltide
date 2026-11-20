"use client";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, BadgeCheck, Bot, Check, CheckCircle2, Crown, Lock, Share2, UserPlus, XCircle, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoom } from "@/lib/chat";
import type { ExperienceView, PublicMission, PublicStage } from "@/lib/types";
import { burst } from "@/lib/confetti";
import { useDisco } from "@/lib/disco";
import { play } from "@/lib/sfx";
import { recordSolve, recordVisit } from "@/lib/taste";
import { MOOD_COLORS } from "@/lib/templates";
import ChatPanel from "./ChatPanel";
import { CrewStart, fmt, LaunchBanner, Leaderboard, RunBanner, useNow } from "./CrewParts";
import { useAuth } from "./IdentityProvider";
import Scene3D from "./Scene3D";

interface SubmitOut {
  result: { correct: boolean; stageUnlocked: boolean; completed: boolean; message: string };
  view: ExperienceView;
}

export default function ExperienceClient({ id }: { id: string }) {
  const { identity, ready, ensure } = useAuth();
  const [view, setView] = useState<ExperienceView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const stageRef = useRef<number | null>(null);
  const router = useRouter();
  const [solo, setSolo] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const solvedRef = useRef<number | null>(null);
  const lastReact = useRef(0);
  const disco = useDisco();
  const tick = useNow(Boolean(view?.startsAt), 1000);
  const uid = identity?.id;

  const apply = useCallback((v: ExperienceView) => {
    const mark = v.status === "COMPLETED" ? v.stages.length : v.currentStage;
    if (stageRef.current !== null && mark > stageRef.current) {
      setPulse((p) => p + 1);
      burst([v.theme.accent, v.theme.accent2, "#ede8e0"], "big");
      play(v.status === "COMPLETED" ? "win" : "unlock");
      setBanner(v.status === "COMPLETED" ? "The community finished the experience!" : `Stage unlocked: ${v.stages[v.currentStage]?.title}`);
      setTimeout(() => setBanner(null), 5000);
    }
    stageRef.current = mark;
    setView(v);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/experiences/${id}${uid ? `?userId=${uid}` : ""}`, { cache: "no-store" });
      if (r.status === 404) return setNotFound(true);
      if (r.ok) apply(await r.json());
    } catch {}
  }, [id, uid, apply]);

  useEffect(() => {
    if (!ready) return;
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [ready, refresh]);

  const addFloater = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    setFloaters((p) => [...p.slice(-14), { id, emoji, x: Math.round(Math.random() * 140) }]);
    setTimeout(() => setFloaters((p) => p.filter((f) => f.id !== id)), 2700);
    play("react");
  }, []);

  const room = useRoom(view, identity, () => void refresh(), { onReact: (e) => addFloater(e), onIncoming: () => play("ping") });

  const sendReaction = (emoji: string) => {
    const now = Date.now();
    if (now - lastReact.current < 350) return; // stay well under the SDK's 5 msg/s limit
    lastReact.current = now;
    addFloater(emoji);
    void room.react(emoji);
  };

  // the city pings whenever anyone in the room solves something
  const solvedTotal = view ? view.members.reduce((n, m) => n + m.done, 0) : 0;
  useEffect(() => {
    if (!view) return;
    if (solvedRef.current !== null && solvedTotal > solvedRef.current) setPulse((p) => p + 1);
    solvedRef.current = solvedTotal;
  }, [solvedTotal, view]);

  useEffect(() => {
    if (view && !view.sandbox) recordVisit(view.id, view.theme.mood, view.joined, view.joined && view.status === "COMPLETED");
  }, [view?.id, view?.joined, view?.status, view?.sandbox, view?.theme.mood]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setJoining(true);
    try {
      const me = await ensure();
      const r = await fetch(`/api/experiences/${id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: me.id, name: me.name, ref: new URLSearchParams(location.search).get("ref")?.match(/^[a-zA-Z0-9-]{1,20}$/)?.[0] }),
      });
      if (r.ok) apply(await r.json());
      else setJoinErr((await r.json()).error ?? "Couldn't join");
    } finally {
      setJoining(false);
    }
  };

  const demoBot = async () => {
    if (!uid) return;
    const r = await fetch(`/api/experiences/${id}/demo-bot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: uid }),
    });
    if (r.ok) apply(await r.json());
  };

  const trySolo = async () => {
    setSolo(true);
    try {
      const me = await ensure();
      const r = await fetch(`/api/experiences/${id}/sandbox`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: me.id, name: me.name }) });
      const j = await r.json();
      if (r.ok) router.push(`/e/${j.id}`);
      else setSolo(false);
    } catch {
      setSolo(false);
    }
  };

  const stageStates = useMemo(() => view?.stages.map((s) => s.state) ?? [], [view]);

  if (notFound)
    return (
      <div className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="display text-5xl font-bold uppercase leading-[0.9]">Not found</h1>
        <p className="mt-3 text-sm text-dim">It may be a draft, or the link is wrong.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Back to Discover
        </Link>
      </div>
    );
  if (!view) return <div className="mono grid min-h-[60vh] place-items-center text-[11px] uppercase tracking-[0.16em] text-faint">Loading experience…</div>;

  const humans = view.members.filter((m) => m.userId !== "joltideecho");
  const runMs = view.run?.startedAt && view.run.completedAt ? view.run.completedAt - view.run.startedAt : null;
  const notOpen = Boolean(view.startsAt && tick < view.startsAt);
  const lockedReason = view.run && !view.run.startedAt ? "Unlocks when your whole crew has joined." : notOpen ? "Opens at the launch time above." : undefined;
  const hasBot = view.members.some((m) => m.userId === "joltideecho");
  const active = view.stages.find((s) => s.state === "ACTIVE");
  const style = { ["--accent" as string]: view.theme.accent, ["--accent2" as string]: view.theme.accent2 };

  return (
    <div className="relative isolate min-h-[calc(100dvh-56px)]" style={style}>
      <div className="fixed inset-0 top-14 -z-10">
        <Scene3D accent={disco ? MOOD_COLORS[disco][0] : view.theme.accent} accent2={disco ? MOOD_COLORS[disco][1] : view.theme.accent2} seed={view.theme.seed} stages={stageStates} labels={view.stages.map((s) => s.title)} world={view.theme.world} members={view.members.length} pulse={pulse} variant="room" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/65 via-bg/50 to-bg/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/30 to-transparent" />
      </div>

      <HowToPlay joined={view.joined} />

      <div className="pointer-events-none fixed bottom-24 right-6 z-40 h-0 w-40" aria-hidden>
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.span key={f.id} className="absolute bottom-0 text-3xl" style={{ right: f.x }} initial={{ y: 0, opacity: 0, scale: 0.5 }} animate={{ y: -300, opacity: [0, 1, 1, 0], scale: [0.5, 1.4, 1.1, 1] }} transition={{ duration: 2.4, ease: "easeOut" }}>
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div key="banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center">
            <motion.div
              initial={{ clipPath: "inset(0 50% 0 50%)" }}
              animate={{ clipPath: "inset(0 0% 0 0%)" }}
              exit={{ clipPath: "inset(0 50% 0 50%)" }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              className="w-full border-y border-[var(--accent)] bg-bg/90 py-6 text-center backdrop-blur"
              role="status"
            >
              <div className="mono flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">
                <Zap size={14} fill="currentColor" /> Progress
              </div>
              <div className="display mt-2 px-4 text-4xl font-extrabold uppercase leading-none sm:text-6xl">{banner}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <header>
            <div className="mono flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-dim">
              <span className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
                <span className="blink h-1.5 w-1.5 rounded-full bg-current" />
                {view.status === "COMPLETED" ? "Completed" : notOpen ? "Scheduled" : "Live"}
              </span>
              <span>{humans.filter((m) => m.online).length} online</span>
              <span>{humans.length} joined</span>
              <span>by {view.creatorName}</span>
              {view.sandbox && <span style={{ color: "var(--accent2)" }}>Solo demo · private</span>}
              {view.run && <span style={{ color: "var(--accent2)" }}>Crew run · {view.run.crewName}</span>}
            </div>
            <h1 className="display mt-4 font-extrabold uppercase" style={{ fontSize: "clamp(2.8rem, 8vw, 6.5rem)", lineHeight: 0.88 }}>
              {view.title}
            </h1>
            <p className="mt-3 max-w-xl text-dim">{view.tagline}</p>
            <ShareRow title={view.title} uid={uid} hideInvite={Boolean(view.run?.completedAt)} text={runMs ? `${view.run!.crewName} cleared ${view.title} in ${fmt(runMs)}. Think your crew is faster?` : undefined} onSolo={view.sandbox || view.run || solo || notOpen ? undefined : trySolo} extra={!view.sandbox && !view.run && !notOpen ? <CrewStart expId={id} /> : undefined} />
          </header>

          {view.startsAt && <LaunchBanner startsAt={view.startsAt} title={view.title} />}
          {view.run && <RunBanner view={view} uid={uid} />}

          <Track stages={view.stages} />

          <div className="sheet p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!view.joined ? (
                <motion.div key="brief" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <span className="label">The briefing</span>
                  <p className="max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-dim">{view.description}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button className="btn btn-primary" onClick={join} disabled={joining || solo}>
                      {joining ? "Joining…" : "Join experience"} <ArrowRight size={16} />
                    </button>
                    {!view.sandbox && !view.run && !notOpen && (
                      <button className="btn" onClick={trySolo} disabled={joining || solo} title="A private copy with a labelled demo teammate. Nothing here counts toward public stats.">
                        <Bot size={16} /> {solo ? "Setting up…" : "Try it solo"}
                      </button>
                    )}
                  </div>
                  {joinErr && (
                    <p role="alert" className="mt-3 text-sm text-bad">
                      {joinErr}
                    </p>
                  )}
                  <p className="mono mt-4 text-[10px] uppercase tracking-[0.14em] text-faint">No account · pick a name</p>
                </motion.div>
              ) : view.status === "COMPLETED" ? (
                <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <span className="label">Result</span>
                  <div className="display text-5xl font-extrabold uppercase leading-[0.9]" style={{ color: "var(--accent)" }}>
                    {view.run ? "Heist cleared" : "Experience complete"}
                  </div>
                  <p className="mt-3 text-sm text-dim">
                    {view.run ? (runMs ? `${view.run.crewName} finished in ${fmt(runMs)}. Share it and challenge another crew to beat it.` : "Your crew finished.") : "The community unlocked every stage together. The skyline is fully lit."}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {!view.sandbox && <BadgeClaim expId={id} uid={uid!} title={view.title} />}
                    {view.run ? (
                      <Link href={`/e/${view.run.parentId}`} className="btn btn-primary">
                        Beat this time <ArrowRight size={16} />
                      </Link>
                    ) : (
                      <Link href="/studio" className="btn btn-primary">
                        Build your own <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                </motion.div>
              ) : (
                active && (
                  <motion.div key={active.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}>
                    <ActiveStage lockedReason={lockedReason} colors={[view.theme.accent, view.theme.accent2, "#ede8e0"]} expId={id} stage={active} uid={uid!} onView={apply} onShare={(t) => room.send("group", t, "clue")} chatOnline={room.status === "online"} />
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>

          {view.joined && humans.length === 1 && !hasBot && !view.run && view.status === "LIVE" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-line-strong p-4 text-sm">
              <span className="text-dim">Playing solo? Open a second window as your own teammate, or add a labelled demo bot.</span>
              <button className="btn btn-sm" onClick={demoBot}>
                <Bot size={15} /> Add demo teammate
              </button>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="h-[560px]">
            <ChatPanel view={view} meId={uid} status={room.status} error={room.error} group={room.group} live={room.live} watching={room.watching} send={room.send} onReact={sendReaction} />
          </div>
          {!view.sandbox && <Leaderboard expId={view.run?.parentId ?? id} refreshKey={view.run?.completedAt} />}
          <div className="sheet p-5">
            <h3 className="label">Players</h3>
            <ul className="space-y-2">
              {view.members.length === 0 && <li className="text-sm text-dim">Nobody yet. Be first.</li>}
              {[...view.members].sort((a, b) => b.done - a.done).map((m, i) => (
                <li key={m.userId} className="flex items-center gap-3 text-sm">
                  <span className={`h-2 w-2 ${m.online ? "" : "opacity-25"}`} style={{ background: m.color }} />
                  <span className="text-ink">{m.name}</span>
                  {m.userId === uid && <span className="mono text-[10px] uppercase tracking-[0.14em] text-faint">you</span>}
                  {m.role && <span className="mono text-[10px] uppercase tracking-[0.14em] text-dim">{m.role}</span>}
                  {i === 0 && m.done > 0 && view.members.length > 1 && <Crown size={13} className="text-warn" aria-label="Top contributor" />}
                  <span className="mono ml-auto text-[10px] uppercase tracking-[0.14em] text-faint">
                    {m.done} solved · {m.online ? "online" : "away"}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="label mt-6">Activity</h3>
            <ul className="space-y-1.5 text-xs text-dim">
              {view.recent.slice(0, 5).map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="text-faint">/</span>
                  {e.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Track({ stages }: { stages: PublicStage[] }) {
  const activeIdx = Math.max(0, stages.findIndex((s) => s.state === "ACTIVE"));
  const allDone = stages.every((s) => s.state === "COMPLETED");
  const pct = allDone ? 100 : (activeIdx / Math.max(stages.length - 1, 1)) * 100;
  return (
    <ol className="sheet relative grid gap-3 p-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Stages">
      <span className="absolute left-8 right-8 top-[31px] h-px bg-line-strong" aria-hidden />
      <motion.span className="absolute left-8 top-[31px] h-px origin-left bg-[var(--accent)]" style={{ right: "2rem" }} initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1] }} aria-hidden />
      {stages.map((s, i) => (
        <li key={s.id} aria-current={s.state === "ACTIVE" ? "step" : undefined} className="relative min-w-0">
          <span
            className={`relative grid h-[31px] w-[31px] place-items-center border text-[11px] font-bold ${
              s.state === "COMPLETED" ? "border-[var(--accent)] bg-[var(--accent)] text-bg" : s.state === "ACTIVE" ? "pulse-ring border-[var(--accent)] bg-bg text-[var(--accent)]" : "border-line-strong bg-bg text-faint"
            }`}
          >
            {s.state === "COMPLETED" ? <Check size={15} strokeWidth={3} /> : s.state === "LOCKED" ? <Lock size={12} /> : i + 1}
          </span>
          <div className={`mt-2 line-clamp-2 text-[13px] font-semibold leading-tight ${s.state === "LOCKED" ? "text-faint" : "text-ink"}`}>{s.title}</div>
          <div className="mono mt-0.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            {s.state === "ACTIVE" ? `${s.finished}/${s.threshold} done` : s.state === "COMPLETED" ? "Unlocked" : "Locked"}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActiveStage({
  lockedReason,
  colors,
  expId,
  stage,
  uid,
  onView,
  onShare,
  chatOnline,
}: {
  lockedReason?: string;
  colors: string[];
  expId: string;
  stage: PublicStage;
  uid: string;
  onView: (v: ExperienceView) => void;
  onShare: (t: string) => Promise<boolean>;
  chatOnline: boolean;
}) {
  return (
    <div>
      <span className="label" style={{ color: "var(--accent)" }}>
        Now playing
      </span>
      <h2 className="display text-4xl font-bold uppercase leading-[0.92] sm:text-5xl">{stage.title}</h2>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dim">{stage.story}</p>
      <p className="mono mt-3 text-[10px] uppercase tracking-[0.14em] text-faint">
        Unlocks when {stage.threshold} players finish every mission · {stage.finished} so far
      </p>
      {lockedReason && <p className="mono mt-6 border border-dashed border-line-strong p-3 text-[11px] uppercase tracking-[0.12em] text-dim">{lockedReason}</p>}
      <div className="mt-8">
        {stage.missions.map((m, i) => (
          <MissionRow key={m.id} locked={Boolean(lockedReason)} colors={colors} index={i} expId={expId} m={m} uid={uid} onView={onView} onShare={onShare} chatOnline={chatOnline} />
        ))}
      </div>
    </div>
  );
}

function MissionRow({
  locked,
  colors,
  index,
  expId,
  m,
  uid,
  onView,
  onShare,
  chatOnline,
}: {
  locked?: boolean;
  colors: string[];
  index: number;
  expId: string;
  m: PublicMission;
  uid: string;
  onView: (v: ExperienceView) => void;
  onShare: (t: string) => Promise<boolean>;
  chatOnline: boolean;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [shared, setShared] = useState(false);
  const [hint, setHint] = useState(false);
  const shake = useAnimation();

  const submit = async (content: string) => {
    if (!content.trim() || busy) return;
    setBusy(true);
    setFb(null);
    try {
      const r = await fetch(`/api/experiences/${expId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: uid, missionId: m.id, content }),
      });
      const j = (await r.json()) as SubmitOut & { error?: string };
      if (!r.ok) return setFb({ ok: false, text: j.error ?? "Something went wrong" });
      setFb({ ok: j.result.correct, text: j.result.message });
      if (j.result.correct) {
        setVal("");
        recordSolve();
        if (!j.result.stageUnlocked && !j.result.completed) {
          burst(colors, "small");
          play("ok");
        }
      } else {
        play("bad");
        void shake.start({ x: [0, -9, 9, -6, 6, 0], transition: { duration: 0.4 } });
      }
      onView(j.view);
    } finally {
      setBusy(false);
    }
  };

  const total = m.tally ? Object.values(m.tally).reduce((a, b) => a + b, 0) : 0;
  return (
    <article className={`grid gap-x-6 border-t border-line py-7 sm:grid-cols-[3.2rem_minmax(0,1fr)] ${m.done ? "opacity-60" : ""}`} aria-label={m.title}>
      <div className="mono text-[11px] tracking-[0.14em] text-faint">{String(index + 1).padStart(2, "0")}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip">{m.type === "answer" ? "Solve" : m.type === "shard" ? "Collaborate" : "Vote"}</span>
          {m.done && (
            <span className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-ok">
              <CheckCircle2 size={14} /> Done
            </span>
          )}
        </div>
        <h3 className="display mt-3 text-2xl font-bold uppercase leading-none">{m.title}</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-dim">{m.prompt}</p>

        {m.type === "shard" && m.noFragment && <p className="mt-4 border border-dashed border-line-strong p-3 text-sm text-dim">You hold no piece on this one. Ask your crew for theirs.</p>}

        {m.type === "shard" && m.myShard && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border border-dashed border-warn/60 bg-warn/[0.06] p-4">
            <div>
              <div className="mono text-[9px] uppercase tracking-[0.2em] text-warn">Only you can see this</div>
              <div className="display mt-1 text-2xl font-bold uppercase">{m.myShard}</div>
            </div>
            <button
              className="btn btn-sm ml-auto"
              disabled={!chatOnline || shared}
              onClick={async () => setShared(await onShare(`${m.title}: ${m.myShard}`))}
              title={chatOnline ? "Post this fragment to your team room through Nexconn" : "Chat offline"}
            >
              {shared ? <Check size={15} /> : <Share2 size={15} />} {shared ? "Shared" : "Share in team room"}
            </button>
          </div>
        )}

        {m.type === "vote" ? (
          <div className="mt-5 space-y-2">
            {m.options?.map((o) => {
              const n = m.tally?.[o] ?? 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              const mine = m.myVote === o;
              return (
                <button
                  key={o}
                  disabled={busy || locked || Boolean(m.myVote)}
                  onClick={() => submit(o)}
                  className="relative w-full overflow-hidden border border-line-strong px-4 py-3.5 text-left text-sm font-semibold transition-colors enabled:hover:border-[var(--accent)]"
                  style={{ borderColor: mine ? "var(--accent)" : undefined }}
                >
                  <motion.span className="absolute inset-y-0 left-0" style={{ background: "var(--accent)", opacity: 0.22 }} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} />
                  <span className="relative flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {mine && <Check size={15} style={{ color: "var(--accent)" }} />} {o}
                    </span>
                    <span className="mono text-[11px] text-dim">
                      {n} · {pct}%
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          !m.done && (
            <motion.form
              animate={shake}
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(val);
              }}
            >
              <input className="input" disabled={locked} value={val} maxLength={120} onChange={(e) => setVal(e.target.value)} placeholder={m.type === "shard" ? "Enter the combined answer" : "Your answer"} aria-label={`Answer for ${m.title}`} />
              <button className="btn btn-primary" disabled={busy || locked || !val.trim()}>
                {busy ? "…" : "Submit"}
              </button>
            </motion.form>
          )
        )}

        <div className="mt-3 flex min-h-5 items-center justify-between text-xs">
          <span role="status" className={`flex items-center gap-1.5 ${fb ? (fb.ok ? "text-ok" : "text-bad") : ""}`}>
            {fb && (fb.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />)}
            {fb?.text}
          </span>
          {m.hint && !m.done && (
            <button className="mono text-[10px] uppercase tracking-[0.14em] text-faint underline-offset-4 hover:text-dim hover:underline" onClick={() => setHint((h) => !h)}>
              {hint ? m.hint : "Need a hint?"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ShareRow({ title, uid, onSolo, extra, text, hideInvite }: { title: string; uid?: string; onSolo?: () => void; extra?: React.ReactNode; text?: string; hideInvite?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${location.origin}${location.pathname}${uid ? `?ref=inv-${uid.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}` : ""}`;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {extra}
      {!hideInvite && (
      <button
        className="btn btn-sm"
        onClick={() => {
          navigator.clipboard?.writeText(url());
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check size={14} /> : <UserPlus size={14} />} {copied ? "Invite link copied" : "Invite a friend"}
      </button>
      )}
      <a
        className="btn btn-sm"
        target="_blank"
        rel="noopener noreferrer"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text ?? `Play "${title}" with me. Nobody solves it alone.`)}&url=${typeof location !== "undefined" ? encodeURIComponent(`${location.origin}${location.pathname}?ref=x`) : ""}`}
      >
        <Share2 size={14} /> Post on X
      </a>
      {onSolo && (
        <button className="btn btn-sm" onClick={onSolo} title="A private copy with a labelled demo teammate">
          <Bot size={14} /> Solo demo
        </button>
      )}
    </div>
  );
}

const STEPS = [
  ["Read the stage", "Each stage has a short story and a few missions on the left."],
  ["You hold a different clue", "Some missions give every player a different fragment. Share yours in the team room to solve it together."],
  ["Unlock it together", "When enough players finish a stage, the next one opens for everyone and the city lights up."],
];

function HowToPlay({ joined }: { joined: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!joined) return;
    try {
      if (!localStorage.getItem("joltide:intro")) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [joined]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem("joltide:intro", "1");
    } catch {}
  };
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 border border-line-strong bg-panel p-7">
          <span className="label">How to play</span>
          <Dialog.Title className="display text-4xl font-bold uppercase leading-[0.92]">Nobody solves it alone</Dialog.Title>
          <Dialog.Description className="sr-only">Three quick steps to get started</Dialog.Description>
          <ol className="mt-6 space-y-5">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="mono text-[11px] tracking-[0.14em] text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-dim">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <button className="btn btn-primary mt-7" onClick={close}>
            Got it <ArrowRight size={16} />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BadgeClaim({ expId, uid, title }: { expId: string; uid: string; title: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const claim = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/experiences/${expId}/badge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: uid }) });
      const j = await r.json();
      if (r.ok) setPath(j.path);
      else setErr(j.error ?? "Couldn't issue the badge");
    } finally {
      setBusy(false);
    }
  };
  if (!path)
    return (
      <div>
        <button className="btn" onClick={claim} disabled={busy}>
          <BadgeCheck size={16} /> {busy ? "Signing…" : "Claim your verified badge"}
        </button>
        {err && <p className="mt-2 text-xs text-bad">{err}</p>}
      </div>
    );
  const url = `${location.origin}${path}`;
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn" href={path} target="_blank" rel="noopener noreferrer">
        <BadgeCheck size={16} /> View badge
      </a>
      <button
        className="btn"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? "Copied" : "Copy link"}
      </button>
      <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I helped unlock "${title}" on JOLTIDE.`)}&url=${encodeURIComponent(url)}`}>
        Post on X
      </a>
    </div>
  );
}
