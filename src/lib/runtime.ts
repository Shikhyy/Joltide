import { randomBytes } from "node:crypto";
import type {
  Aggregate,
  Experience,
  ExperienceCard,
  ExperienceView,
  GameEvent,
  Member,
  Mission,
  PublicMission,
  PublicStage,
  Stage,
  Theme,
} from "./types";
import { HttpError, listAggregates, saveAggregate, getAggregate } from "./store";
import * as nx from "./nexconn-server";
import { harborVault, mission, neonDistrict, stage } from "./templates";

/* -------------------------------------------------------------------------- */
/*  JOLTIDE Experience Runtime                                                  */
/*  The backend is the only authority on missions, votes and stage unlocks.     */
/*  Nexconn carries human conversation + pushes state-change events.            */
/* -------------------------------------------------------------------------- */

const PALETTE = ["#8b5cf6", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#fb7185", "#a78bfa"];
const ONLINE_MS = 25_000;
const BOT_ID = "joltideecho";

export const genId = (len = 8) =>
  randomBytes(len).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, len).padEnd(len, "x");

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const checkAnswer = (m: Mission, content: string) =>
  (m.answer ?? "")
    .split("|")
    .map(norm)
    .filter(Boolean)
    .includes(norm(content));

const ev = (type: GameEvent["type"], text: string, extra: Partial<GameEvent> = {}): GameEvent => ({
  id: genId(6),
  at: Date.now(),
  type,
  text,
  ...extra,
});

/* ----------------------------- creation / seed ----------------------------- */

export interface NewExperienceInput {
  title: string;
  tagline: string;
  description: string;
  theme: Theme;
  stages: Stage[];
  source: Experience["source"];
  streamUrl?: string;
  clonedFrom?: string;
  startsAt?: number;
}

export function newAggregate(
  input: NewExperienceInput,
  creator: { id: string; name: string },
  opts: { id?: string; live?: boolean } = {},
): Aggregate {
  const id = opts.id ?? genId(8);
  const exp: Experience = {
    id,
    title: input.title.slice(0, 80),
    tagline: input.tagline.slice(0, 160),
    description: input.description.slice(0, 1200),
    theme: input.theme,
    stages: input.stages,
    status: opts.live ? "LIVE" : "DRAFT",
    currentStage: 0,
    creatorId: creator.id,
    creatorName: creator.name.slice(0, 40),
    creatorKey: genId(24),
    source: input.source,
    streamUrl: input.streamUrl,
    startsAt: input.startsAt,
    clonedFrom: input.clonedFrom,
    createdAt: Date.now(),
    publishedAt: opts.live ? Date.now() : undefined,
  };
  return { exp, members: [], submissions: [], events: [] };
}

/** A private copy of an experience for one visitor, with the labelled demo bot already on the team. */
export function cloneAsSandbox(src: Aggregate, user: { id: string; name: string }): Aggregate {
  const e = src.exp;
  const stages = e.stages.map((s) =>
    stage({
      title: s.title,
      story: s.story,
      threshold: Math.min(s.threshold, 2), // you + the bot
      missions: s.missions.map((m) => mission({ type: m.type, title: m.title, prompt: m.prompt, answer: m.answer, shards: m.shards, options: m.options, hint: m.hint })),
    }),
  );
  const agg = newAggregate(
    { title: `${e.title} (solo demo)`, tagline: e.tagline, description: e.description, theme: e.theme, stages, source: "template", clonedFrom: e.id },
    user,
    { live: true },
  );
  agg.exp.sandbox = true;
  agg.events.push(ev("published", "Solo demo started"));
  return agg;
}

/** Player-to-player invite links look like ref=inv-xxxxxxxx; group them. */
export const srcName = (ref?: string) => (!ref ? "direct" : ref.startsWith("inv-") ? "player-invite" : ref);

export const SEED_ID = "neondistrict";

/** The flagship experience is always available so anyone can try the product in seconds. */
const SEEDS: { id: string; build: typeof neonDistrict }[] = [
  { id: SEED_ID, build: neonDistrict },
  { id: "harborvault", build: harborVault },
];

/** The flagship experiences are always available, so anyone can try the product in seconds. */
export async function ensureSeed() {
  for (const { id, build } of SEEDS) {
    const existing = await getAggregate(id);
    const t = build();
    if (existing) {
      // look follows the code, but never progress or puzzle ids
      if (existing.exp.theme.accent !== t.theme.accent || existing.exp.theme.accent2 !== t.theme.accent2) {
        existing.exp.theme = t.theme;
        await saveAggregate(existing);
      }
      continue;
    }
    const agg = newAggregate({ ...t, source: "seed" }, { id: "joltide", name: "JOLTIDE Originals" }, { id, live: true });
    agg.events.push(ev("published", `${t.title} went live`));
    await saveAggregate(agg);
  }
}

export const ROLES = ["Hacker", "Driver", "Inside Man", "Lookout"];

/** A private crew run: friends join by link, wait in a lobby, then race the clock. */
export function createCrewRun(src: Aggregate, user: { id: string; name: string }, crewName: string, size: number): Aggregate {
  const e = src.exp;
  const stages = e.stages.map((s) =>
    stage({
      title: s.title,
      story: s.story,
      threshold: size, // the whole crew has to clear each stage
      missions: s.missions.map((m) => mission({ type: m.type, title: m.title, prompt: m.prompt, answer: m.answer, shards: m.shards, options: m.options, hint: m.hint })),
    }),
  );
  const agg = newAggregate(
    { title: e.title, tagline: e.tagline, description: e.description, theme: e.theme, stages, source: "template", clonedFrom: e.id },
    user,
    { live: true },
  );
  agg.exp.run = { parentId: e.id, crewName: crewName.slice(0, 32), size };
  agg.events.push(ev("published", `Crew "${crewName.slice(0, 32)}" formed`));
  return agg;
}

/** Fastest completed crew runs of an experience. */
export async function leaderboard(parentId: string) {
  const all = await listAggregates();
  return all
    .filter((a) => a.exp.run?.parentId === parentId && a.exp.run.startedAt && a.exp.run.completedAt)
    .map((a) => ({
      runId: a.exp.id,
      crew: a.exp.run!.crewName,
      size: a.exp.run!.size,
      ms: a.exp.run!.completedAt! - a.exp.run!.startedAt!,
      players: a.members.filter((m) => !m.isBot).map((m) => m.name),
    }))
    .sort((x, y) => x.ms - y.ms)
    .slice(0, 10);
}

/* --------------------------------- channels -------------------------------- */

export async function ensureChannels(agg: Aggregate): Promise<void> {
  if (!nx.nexconnEnabled) return;
  const { exp } = agg;
  if (exp.groupChannelId && exp.openChannelId) return;
  const groupId = `jtg${exp.id}`;
  const openId = `jto${exp.id}`;
  await nx.createGroup(groupId, exp.title, exp.tagline);
  await nx.createOpenChannel(openId);
  exp.groupChannelId = groupId;
  exp.openChannelId = openId;
  // re-join anyone who joined before channels existed
  const humans = agg.members.filter((m) => !m.isBot).map((m) => m.userId);
  for (let i = 0; i < humans.length; i += 100) await nx.joinGroup(groupId, humans.slice(i, i + 100)).catch(() => {});
}

async function emit(agg: Aggregate, payload: Record<string, unknown>) {
  if (!nx.nexconnEnabled || !agg.exp.groupChannelId) return;
  await nx
    .pushEvent(agg.exp.groupChannelId, agg.exp.openChannelId, { ...payload, at: Date.now() })
    .catch(() => {});
}

/* ----------------------------- member management ---------------------------- */

export async function joinExperience(agg: Aggregate, userId: string, name: string, ref?: string): Promise<Member> {
  if (agg.exp.status === "DRAFT") throw new HttpError(409, "This experience isn't published yet");
  let m = agg.members.find((x) => x.userId === userId);
  if (m) {
    m.lastSeen = Date.now();
    m.name = name.slice(0, 32) || m.name;
    return m;
  }
  const humans = agg.members.filter((x) => !x.isBot);
  if (agg.exp.run && humans.length >= agg.exp.run.size) throw new HttpError(409, "This crew is already full");
  m = {
    userId,
    name: name.slice(0, 32) || "Player",
    color: PALETTE[humans.length % PALETTE.length],
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    slot: agg.members.length,
    ref: ref?.toLowerCase(),
  };
  agg.members.push(m);
  agg.events.push(ev("joined", `${m.name} joined`, { actor: userId }));
  let started = false;
  if (agg.exp.run && !agg.exp.run.startedAt && humans.length + 1 >= agg.exp.run.size) {
    agg.exp.run.startedAt = Date.now();
    started = true;
    agg.events.push(ev("announcement", "Crew complete. The heist clock is running."));
  }
  try {
    await ensureChannels(agg);
    if (agg.exp.groupChannelId) await nx.joinGroup(agg.exp.groupChannelId, [userId]);
  } catch (e) {
    console.error("[nexconn] join failed", (e as Error).message);
  }
  await emit(agg, { kind: "joined", name: m.name });
  if (started) await emit(agg, { kind: "started" });
  return m;
}

/* ---------------------------------- demo bot -------------------------------- */

/** An honest, labelled demo teammate so a solo judge can see the collaborative loop. */
export async function addDemoBot(agg: Aggregate): Promise<void> {
  if (agg.exp.status !== "LIVE") throw new HttpError(409, "Experience is not live");
  if (agg.members.some((m) => m.isBot)) return;
  agg.members.push({
    userId: BOT_ID,
    name: "Echo (demo bot)",
    color: "#94a3b8",
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    slot: agg.members.length,
    isBot: true,
  });
  agg.events.push(ev("joined", "Echo (demo bot) joined", { actor: BOT_ID }));
  await botTurn(agg);
}

async function botTurn(agg: Aggregate) {
  const bot = agg.members.find((m) => m.isBot);
  if (!bot || agg.exp.status !== "LIVE") return;
  const st = agg.exp.stages[agg.exp.currentStage];
  if (!st) return;
  const lines: string[] = [];
  for (const m of st.missions) {
    if (agg.submissions.some((s) => s.userId === bot.userId && s.missionId === m.id && s.correct)) continue;
    const content =
      m.type === "vote" ? (m.options ?? [])[0] ?? "" : m.type === "shard" || m.type === "answer" ? m.answer?.split("|")[0] ?? "" : "";
    agg.submissions.push({
      id: genId(8),
      missionId: m.id,
      stageId: st.id,
      userId: bot.userId,
      content,
      correct: true,
      at: Date.now(),
    });
    if (m.type === "shard" && m.shards?.length) {
      const frag = m.shards[bot.slot % m.shards.length];
      lines.push(`My fragment for "${m.title}": ${frag.replace(/^.*?:\s*/, "")} (${frag.split(":")[0]})`);
    }
  }
  if (lines.length && agg.exp.groupChannelId && nx.nexconnEnabled) {
    try {
      await nx.issueToken(BOT_ID, "Echo (demo bot)");
      await nx.joinGroup(agg.exp.groupChannelId, [BOT_ID]);
      for (const l of lines) await nx.sendGroupText(agg.exp.groupChannelId, BOT_ID, l);
    } catch (e) {
      console.error("[nexconn] bot message failed", (e as Error).message);
    }
  }
  await evaluateProgress(agg, true);
}

/* --------------------------------- progress --------------------------------- */

const missionDone = (agg: Aggregate, userId: string, missionId: string) =>
  agg.submissions.some((s) => s.userId === userId && s.missionId === missionId && s.correct);

const stageFinishedBy = (agg: Aggregate, st: Stage, userId: string) =>
  st.missions.every((m) => missionDone(agg, userId, m.id));

const finishedCount = (agg: Aggregate, st: Stage) =>
  agg.members.filter((m) => stageFinishedBy(agg, st, m.userId)).length;

/** The authoritative rule: unlock when enough distinct participants finished the stage. */
async function evaluateProgress(agg: Aggregate, fromBot = false): Promise<boolean> {
  let advanced = false;
  for (;;) {
    const { exp } = agg;
    if (exp.status !== "LIVE") break;
    const st = exp.stages[exp.currentStage];
    if (!st) break;
    if (finishedCount(agg, st) < st.threshold) break;
    advanced = true;
    const isLast = exp.currentStage >= exp.stages.length - 1;
    if (isLast) {
      exp.status = "COMPLETED";
      if (exp.run) exp.run.completedAt = Date.now();
      agg.events.push(ev("completed", `"${exp.title}" completed by the community`, { stageIndex: exp.currentStage }));
      await emit(agg, { kind: "completed", title: exp.title });
      break;
    }
    exp.currentStage += 1;
    const next = exp.stages[exp.currentStage];
    agg.events.push(ev("stage_unlocked", `Stage unlocked: ${next.title}`, { stageIndex: exp.currentStage }));
    await emit(agg, { kind: "stage_unlocked", stage: exp.currentStage, title: next.title });
    if (!fromBot) await botTurn(agg); // bot keeps pace with the humans
    else break;
  }
  return advanced;
}

export interface SubmitResult {
  correct: boolean;
  stageUnlocked: boolean;
  completed: boolean;
  message: string;
}

const lastSubmit = new Map<string, number>();

export async function submit(
  agg: Aggregate,
  userId: string,
  missionId: string,
  content: string,
): Promise<SubmitResult> {
  const { exp } = agg;
  const member = agg.members.find((m) => m.userId === userId);
  if (!member) throw new HttpError(403, "Join the experience first");
  if (exp.status === "DRAFT") throw new HttpError(409, "Experience is not live");
  if (exp.startsAt && Date.now() < exp.startsAt) throw new HttpError(409, "This experience hasn't started yet");
  if (exp.run && !exp.run.startedAt) throw new HttpError(409, "Waiting for the rest of your crew to join");
  const st = exp.stages[exp.currentStage];
  const mission = st?.missions.find((m) => m.id === missionId);
  if (!st || !mission) throw new HttpError(409, "That mission isn't active right now");
  content = content.trim().slice(0, 200);
  if (!content) throw new HttpError(400, "Empty submission");

  const key = `${exp.id}:${userId}`;
  const now = Date.now();
  if (now - (lastSubmit.get(key) ?? 0) < 800) throw new HttpError(429, "Slow down a little");
  lastSubmit.set(key, now);

  if (missionDone(agg, userId, missionId)) {
    return { correct: true, stageUnlocked: false, completed: exp.status === "COMPLETED", message: "Already complete" };
  }

  let correct: boolean;
  if (mission.type === "vote") {
    correct = (mission.options ?? []).includes(content);
    if (!correct) throw new HttpError(400, "Not a valid option");
  } else {
    correct = checkAnswer(mission, content);
  }
  agg.submissions.push({ id: genId(8), missionId, stageId: st.id, userId, content, correct, at: now });
  if (!correct) return { correct: false, stageUnlocked: false, completed: false, message: "Not quite. Compare notes in chat." };

  agg.events.push(
    ev(mission.type === "vote" ? "vote" : "mission_complete", `${member.name} ${mission.type === "vote" ? "voted" : "completed"} "${mission.title}"`, {
      actor: userId,
      stageIndex: exp.currentStage,
    }),
  );
  const before = exp.currentStage;
  await evaluateProgress(agg);
  const unlocked = exp.currentStage !== before || exp.status === "COMPLETED";
  if (!unlocked) await emit(agg, { kind: "progress" });
  return {
    correct: true,
    stageUnlocked: unlocked && exp.status !== "COMPLETED",
    completed: exp.status === "COMPLETED",
    message: exp.status === "COMPLETED" ? "The community finished the experience!" : unlocked ? "Stage unlocked!" : "Correct!",
  };
}

export async function publish(agg: Aggregate): Promise<void> {
  if (agg.exp.status !== "DRAFT") return;
  agg.exp.status = "LIVE";
  agg.exp.publishedAt = Date.now();
  agg.events.push(ev("published", `${agg.exp.title} went live`));
  try {
    await ensureChannels(agg);
  } catch (e) {
    console.error("[nexconn] channel creation failed", (e as Error).message);
  }
}

/* ---------------------------------- views ---------------------------------- */

export function view(agg: Aggregate, userId?: string): ExperienceView {
  const { exp } = agg;
  const now = Date.now();
  const joined = Boolean(userId && agg.members.some((m) => m.userId === userId));
  const me = userId ? agg.members.find((m) => m.userId === userId) : undefined;

  const stages: PublicStage[] = exp.stages.map((st, i) => {
    const state: PublicStage["state"] =
      exp.status === "COMPLETED" || i < exp.currentStage ? "COMPLETED" : i === exp.currentStage ? "ACTIVE" : "LOCKED";
    const missions: PublicMission[] =
      state === "LOCKED"
        ? []
        : st.missions.map((m) => {
            const pm: PublicMission = {
              id: m.id,
              type: m.type,
              title: m.title,
              prompt: m.prompt,
              hint: m.hint,
              options: m.options,
              done: Boolean(userId && missionDone(agg, userId, m.id)),
            };
            if (m.type === "shard" && me && m.shards?.length) {
              // in a crew run, fragments are dealt round-robin so a crew of 2 still holds every piece
              const size = exp.run?.size;
              const mine = size ? m.shards.filter((_, k) => k % size === me.slot % size) : [m.shards[me.slot % m.shards.length]];
              pm.myShard = mine.join("  ·  ") || undefined;
              pm.noFragment = mine.length === 0;
              pm.shardCount = m.shards.length;
            }
            if (m.type === "vote") {
              pm.tally = Object.fromEntries((m.options ?? []).map((o) => [o, 0]));
              for (const s of agg.submissions)
                if (s.missionId === m.id && s.correct && s.content in pm.tally) pm.tally[s.content]++;
              pm.myVote = agg.submissions.find((s) => s.missionId === m.id && s.userId === userId && s.correct)?.content;
            }
            return pm;
          });
    return {
      id: st.id,
      title: st.title,
      story: state === "LOCKED" ? "" : st.story,
      threshold: st.threshold,
      state,
      finished: state === "LOCKED" ? 0 : finishedCount(agg, st),
      missions,
      missionCount: st.missions.length,
    };
  });

  return {
    id: exp.id,
    title: exp.title,
    tagline: exp.tagline,
    description: exp.description,
    theme: exp.theme,
    status: exp.status,
    currentStage: exp.currentStage,
    creatorName: exp.creatorName,
    creatorId: exp.creatorId,
    source: exp.source,
    streamUrl: exp.streamUrl,
    groupChannelId: exp.groupChannelId,
    openChannelId: exp.openChannelId,
    chatEnabled: nx.nexconnEnabled,
    sandbox: Boolean(exp.sandbox),
    members: agg.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      color: m.color,
      online: m.isBot || now - m.lastSeen < ONLINE_MS,
      done: agg.submissions.filter((s) => s.userId === m.userId && s.correct).length,
      role: exp.run ? ROLES[m.slot % ROLES.length] : undefined,
    })),
    startsAt: exp.startsAt,
    run: exp.run,
    stages,
    joined,
    recent: agg.events.slice(-12).reverse(),
    publishedAt: exp.publishedAt,
  };
}

export function card(agg: Aggregate): ExperienceCard {
  return {
    id: agg.exp.id,
    title: agg.exp.title,
    tagline: agg.exp.tagline,
    theme: agg.exp.theme,
    status: agg.exp.status,
    creatorName: agg.exp.creatorName,
    participants: agg.members.filter((m) => !m.isBot).length,
    stages: agg.exp.stages.length,
    currentStage: agg.exp.currentStage,
    source: agg.exp.source,
  };
}

export async function listCards(): Promise<ExperienceCard[]> {
  await ensureSeed();
  const all = await listAggregates();
  return all
    .filter((a) => a.exp.status !== "DRAFT" && !a.exp.sandbox && !a.exp.run)
    .sort((a, b) => (b.exp.source === "seed" ? 1 : 0) - (a.exp.source === "seed" ? 1 : 0) || b.members.length - a.members.length)
    .map(card);
}

export function analytics(agg: Aggregate) {
  const humans = agg.members.filter((m) => !m.isBot);
  const now = Date.now();
  const funnel = agg.exp.stages.map((st, i) => {
    const reached = i <= agg.exp.currentStage || agg.exp.status === "COMPLETED";
    const finished = reached ? humans.filter((m) => stageFinishedBy(agg, st, m.userId)).length : 0;
    return { stage: st.title, threshold: st.threshold, finished, reached };
  });
  const human = new Set(humans.map((h) => h.userId));
  const subs = agg.submissions.filter((s) => human.has(s.userId));
  const votes: Record<string, Record<string, number>> = {};
  for (const st of agg.exp.stages)
    for (const m of st.missions)
      if (m.type === "vote")
        votes[m.title] = Object.fromEntries(
          (m.options ?? []).map((o) => [o, subs.filter((s) => s.missionId === m.id && s.correct && s.content === o).length]),
        );
  return {
    participants: humans.length,
    activeNow: humans.filter((m) => now - m.lastSeen < ONLINE_MS).length,
    submissions: subs.length,
    correctRate: subs.length ? Math.round((subs.filter((s) => s.correct).length / subs.length) * 100) : 0,
    funnel,
    votes,
    status: agg.exp.status,
    currentStage: agg.exp.currentStage,
    events: agg.events.slice(-25).reverse(),
    members: humans.map((m) => ({
      userId: m.userId,
      name: m.name,
      color: m.color,
      joinedAt: m.joinedAt,
      completed: agg.exp.stages.reduce(
        (n, st) => n + st.missions.filter((mi) => missionDone(agg, m.userId, mi.id)).length,
        0,
      ),
    })),
    sources: Object.entries(humans.reduce<Record<string, number>>((o, m) => ((o[srcName(m.ref)] = (o[srcName(m.ref)] ?? 0) + 1), o), {})).map(([ref, count]) => ({ ref, count })).sort((a, b) => b.count - a.count),
    startsAt: agg.exp.startsAt ?? null,
    listed: Boolean(agg.exp.listedAsTemplate),
    remixes: agg.exp.remixCount ?? 0,
    totalMissions: agg.exp.stages.reduce((n, s) => n + s.missions.length, 0),
    chat: {
      groupChannelId: agg.exp.groupChannelId ?? null,
      openChannelId: agg.exp.openChannelId ?? null,
    },
  };
}
