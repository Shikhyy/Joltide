"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, KeyRound, Plus, Sparkles, Trash2, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCreatorKey, myExperienceIds, setCreatorKey } from "@/lib/identity";
import { MOODS, MOOD_COLORS, deriveWorld } from "@/lib/templates";
import type { MissionType, Theme, WorldParams } from "@/lib/types";
import { useAuth } from "./IdentityProvider";
import Waitlist from "./Waitlist";

interface FMission {
  type: MissionType;
  title: string;
  prompt: string;
  answer: string;
  shards: string[];
  options: string[];
  hint: string;
}
interface FStage {
  title: string;
  story: string;
  threshold: number;
  missions: FMission[];
}
interface Form {
  title: string;
  tagline: string;
  description: string;
  theme: Theme;
  streamUrl: string;
  /** local datetime-local value; empty means "open immediately" */
  startsAt: string;
  stages: FStage[];
  source: "ai" | "template" | "manual";
}

const blankMission = (type: MissionType = "answer"): FMission => ({
  type,
  title: "New mission",
  prompt: "",
  answer: "",
  shards: type === "shard" ? ["Fragment A: ", "Fragment B: "] : [],
  options: type === "vote" ? ["Option one", "Option two"] : [],
  hint: "",
});
const blankForm = (): Form => ({
  title: "",
  tagline: "",
  description: "",
  theme: { accent: "#8b5cf6", accent2: "#22d3ee", mood: "neon", seed: 12 },
  streamUrl: "",
  startsAt: "",
  stages: [{ title: "Stage 1", story: "", threshold: 2, missions: [blankMission()] }],
  source: "manual",
});

const GEN_STEPS = ["Reading your idea", "Drafting the stages", "Writing puzzles and clues", "Choosing a look", "Final checks"];

const IDEAS = [
  "A 3-stage cyberpunk investigation where players discover clues individually, collaborate in teams, and unlock a final community mystery",
  "A haunted lighthouse escape for a horror streamer's community, with a vote on which door to open",
  "A heist planning relay where every fan holds one piece of the vault code",
];

export default function StudioClient() {
  const { ensure } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const [form, setForm] = useState<Form | null>(null);
  const [prompt, setPrompt] = useState("");
  const [gen, setGen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [genStep, setGenStep] = useState(0);
  const [mine, setMine] = useState<{ id: string; title: string; status: string }[]>([]);

  // load an existing draft for editing
  useEffect(() => {
    if (!editId) return;
    const key = getCreatorKey(editId);
    if (!key) return setErr("This browser doesn't hold the creator key for that draft.");
    fetch(`/api/experiences/${editId}/draft`, { headers: { "x-creator-key": key } })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        const ms = typeof j.startsAt === "number" ? j.startsAt : null;
        setForm({ ...j, startsAt: ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "", source: "template" });
      })
      .catch((e) => setErr(e.message));
  }, [editId]);

  // "my experiences"
  useEffect(() => {
    Promise.all(
      myExperienceIds().map(async (id) => {
        const key = getCreatorKey(id);
        if (!key) return null;
        const r = await fetch(`/api/experiences/${id}/draft`, { headers: { "x-creator-key": key } });
        if (!r.ok) return null;
        const j = await r.json();
        return { id, title: j.title as string, status: j.status as string };
      }),
    ).then((l) => setMine(l.filter((x): x is { id: string; title: string; status: string } => !!x)));
  }, []);

  useEffect(() => {
    if (!gen) return setGenStep(0);
    const t = setInterval(() => setGenStep((n) => Math.min(n + 1, GEN_STEPS.length - 1)), 1700);
    return () => clearInterval(t);
  }, [gen]);

  const issues = useMemo(() => {
    if (!form) return [];
    const out: string[] = [];
    if (!form.title.trim()) out.push("Give the experience a title");
    form.stages.forEach((st, i) =>
      st.missions.forEach((m, j) => {
        const tag = `Stage ${i + 1} · mission ${j + 1}`;
        if (!m.prompt.trim()) out.push(`${tag}: add a prompt`);
        if (m.type !== "vote" && !m.answer.trim()) out.push(`${tag}: add the correct answer`);
        if (m.type === "shard" && m.shards.filter((x) => x.trim()).length < 2) out.push(`${tag}: needs two fragments`);
        if (m.type === "vote" && m.options.filter((x) => x.trim()).length < 2) out.push(`${tag}: needs two options`);
      }),
    );
    return out;
  }, [form]);

  const generate = async () => {
    setGen(true);
    setErr(null);
    setNote(null);
    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setForm({
        title: j.title,
        tagline: j.tagline,
        description: j.description,
        theme: j.theme,
        streamUrl: "",
        startsAt: "",
        source: "ai",
        stages: j.stages.map((s: { title: string; story: string; threshold: number; missions: Partial<FMission>[] }) => ({
          title: s.title,
          story: s.story,
          threshold: s.threshold ?? 2,
          missions: s.missions.map((m) => ({ ...blankMission(m.type), ...m, answer: m.answer ?? "", hint: m.hint ?? "", shards: m.shards ?? [], options: m.options ?? [] })),
        })),
      });
      setNote(j.note ?? (j.generator === "claude" ? "Generated by Claude. Review and tweak everything before publishing." : null));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGen(false);
    }
  };

  const save = async (publish: boolean) => {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      const me = await ensure();
      const body = {
        userId: me.id,
        userName: me.name,
        title: form.title,
        tagline: form.tagline,
        description: form.description,
        theme: form.theme,
        streamUrl: form.streamUrl,
        startsAt: form.startsAt && !Number.isNaN(new Date(form.startsAt).getTime()) ? new Date(form.startsAt).getTime() : undefined,
        source: form.source,
        stages: form.stages.map((s) => ({
          ...s,
          missions: s.missions.map((m) => ({
            type: m.type,
            title: m.title,
            prompt: m.prompt,
            hint: m.hint || undefined,
            answer: m.type === "vote" ? undefined : m.answer,
            shards: m.type === "shard" ? m.shards.filter(Boolean) : undefined,
            options: m.type === "vote" ? m.options.filter(Boolean) : undefined,
          })),
        })),
      };
      let id = editId;
      if (editId) {
        const key = getCreatorKey(editId)!;
        const r = await fetch(`/api/experiences/${editId}/draft`, { method: "PUT", headers: { "content-type": "application/json", "x-creator-key": key }, body: JSON.stringify({ ...body, publish: false }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
      } else {
        const r = await fetch("/api/experiences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, publish: false }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        id = j.id;
        setCreatorKey(j.id, j.creatorKey);
      }
      if (publish && id) {
        const r = await fetch(`/api/experiences/${id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creatorKey: getCreatorKey(id) }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
      }
      router.push(`/studio/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const patchStage = (i: number, p: Partial<FStage>) => setForm((f) => f && { ...f, stages: f.stages.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const patchMission = (i: number, j: number, p: Partial<FMission>) =>
    setForm((f) => f && { ...f, stages: f.stages.map((s, k) => (k === i ? { ...s, missions: s.missions.map((m, l) => (l === j ? { ...m, ...p } : m)) } : s)) });

  const MTYPES: { v: MissionType; label: string; icon: typeof KeyRound }[] = [
    { v: "answer", label: "Solve", icon: KeyRound },
    { v: "shard", label: "Collaborate", icon: Users },
    { v: "vote", label: "Vote", icon: Vote },
  ];
  const EASE = [0.2, 0.7, 0.2, 1] as const;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <div className="mono flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-faint">
        <span className="text-signal">Studio</span>
        <span className="h-px w-10 bg-line-strong" />
        {form ? (editId ? "Editing draft" : "Review & publish") : "New experience"}
      </div>
      <h1 className="display mt-5 text-6xl font-extrabold uppercase leading-[0.88] sm:text-8xl">{form ? (form.title || "Untitled world") : "Design a world."}</h1>
      {!form && !editId && <p className="mt-5 max-w-xl text-dim">Describe it in a sentence. The AI designer drafts stages, puzzles, a vote and a look. Nothing goes live until you approve it.</p>}

      {err && (
        <p role="alert" className="mt-8 flex items-center gap-3 border border-bad/50 bg-bad/10 px-4 py-3 text-sm text-bad">
          <AlertCircle size={16} /> {err}
        </p>
      )}

      {!form && !editId && (
        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="relative overflow-hidden border border-line-strong bg-panel p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {gen ? (
                <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6" role="status" aria-live="polite">
                  <span className="label">Designing</span>
                  <ul className="space-y-3">
                    {GEN_STEPS.map((t, i) => (
                      <li key={t} className={`flex items-center gap-3 text-lg transition-colors ${i < genStep ? "text-faint" : i === genStep ? "text-ink" : "text-faint/50"}`}>
                        <span className="mono w-6 text-[11px] text-signal">{i < genStep ? "ok" : i === genStep ? <span className="blink">..</span> : ""}</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 h-px bg-line-strong">
                    <motion.div className="h-px bg-signal" initial={{ width: "4%" }} animate={{ width: `${((genStep + 1) / GEN_STEPS.length) * 92}%` }} transition={{ duration: 1.2, ease: EASE }} />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label className="label" htmlFor="prompt">
                    Your idea
                  </label>
                  <textarea id="prompt" className="input !min-h-[140px] !text-lg" rows={4} value={prompt} maxLength={600} onChange={(e) => setPrompt(e.target.value)} placeholder="A 3-stage cyberpunk investigation where players discover clues individually, collaborate in teams, and unlock a final mystery" />
                  <div className="mono mt-2 text-right text-[10px] uppercase tracking-[0.14em] text-faint">{prompt.length}/600</div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className="btn btn-primary" disabled={prompt.trim().length < 8} onClick={generate}>
                      <Sparkles size={16} /> Generate with AI
                    </button>
                    <button className="btn" onClick={() => setForm(blankForm())}>
                      Start from blank
                    </button>
                    <Link href="/market" className="btn">
                      Browse templates
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section aria-label="Example ideas">
            <span className="label">Try one of these</span>
            <ul className="border-t border-line">
              {IDEAS.map((i, k) => (
                <li key={i} className="border-b border-line">
                  <button className="group flex w-full items-start gap-4 py-4 text-left" onClick={() => setPrompt(i)}>
                    <span className="mono pt-0.5 text-[11px] text-faint">{String(k + 1).padStart(2, "0")}</span>
                    <span className="flex-1 text-sm leading-relaxed text-dim transition-colors group-hover:text-ink">{i}</span>
                    <ArrowRight size={16} className="mt-1 text-faint transition-transform group-hover:translate-x-1 group-hover:text-signal" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-faint">
              Team workspaces and paid plans aren&apos;t available yet. <Waitlist label="Join the waitlist" />
            </p>
            {mine.length > 0 && (
              <div className="mt-10">
                <span className="label">Your experiences</span>
                <ul className="border-t border-line">
                  {mine.map((m) => (
                    <li key={m.id} className="border-b border-line">
                      <Link href={`/studio/${m.id}`} className="group flex items-center justify-between py-4">
                        <span className="display text-xl font-bold uppercase">{m.title}</span>
                        <span className="mono flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-dim">
                          {m.status === "DRAFT" ? "Draft" : m.status === "COMPLETED" ? "Completed" : "Live"}
                          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {form && (
        <div className="mt-12 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-24" aria-label="Outline">
              <span className="label">Outline</span>
              <ul className="mono space-y-2 text-[11px] uppercase tracking-[0.12em]">
                <li>
                  <a href="#world" className="text-dim hover:text-ink">
                    00 · World
                  </a>
                </li>
                {form.stages.map((s, i) => (
                  <li key={i}>
                    <a href={`#stage-${i}`} className="block truncate text-dim hover:text-ink">
                      {String(i + 1).padStart(2, "0")} · {s.title || "Untitled"}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-2">
                <span className="h-4 w-4" style={{ background: form.theme.accent }} />
                <span className="h-4 w-4" style={{ background: form.theme.accent2 }} />
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-faint">{form.theme.mood}</span>
              </div>
            </nav>
          </aside>

          <div className="min-w-0 pb-28">
            {note && <p className="mb-8 border border-signal/40 bg-signal/[0.07] px-4 py-3 text-sm text-ink">{note}</p>}

            <section id="world" className="scroll-mt-24 border-t border-line pt-6">
              <h2 className="display text-3xl font-bold uppercase">The world</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Title">
                  <input className="input" value={form.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} />
                </Field>
                <Field label="Tagline">
                  <input className="input" value={form.tagline} maxLength={160} onChange={(e) => patch({ tagline: e.target.value })} />
                </Field>
                <Field label="Description" wide>
                  <textarea className="input" rows={3} value={form.description} maxLength={1200} onChange={(e) => patch({ description: e.target.value })} />
                </Field>
                <Field label="Look and feel">
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={form.theme.mood === m}
                        onClick={() => patch({ theme: { ...form.theme, mood: m, accent: MOOD_COLORS[m][0], accent2: MOOD_COLORS[m][1] } })}
                        className={`btn btn-sm capitalize ${form.theme.mood === m ? "!border-ink" : ""}`}
                      >
                        <span className="flex">
                          <span className="h-3 w-3" style={{ background: MOOD_COLORS[m][0] }} />
                          <span className="h-3 w-3" style={{ background: MOOD_COLORS[m][1] }} />
                        </span>
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="City shape (the AI picks this; tweak it)" wide>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {(
                    [
                      ["density", "Density", 0.5, 1, 0.01],
                      ["height", "Tower height", 0.5, 1.8, 0.01],
                      ["fog", "Fog", 0.006, 0.035, 0.001],
                      ["rain", "Rain", 0, 1, 0.01],
                    ] as [keyof WorldParams, string, number, number, number][]
                  ).map(([k, label, lo, hi, step]) => {
                    const w = form.theme.world ?? deriveWorld(form.theme.seed);
                    return (
                      <label key={k} className="block">
                        <span className="mono flex justify-between text-[10px] uppercase tracking-[0.14em] text-dim">
                          {label}
                          <span className="text-faint">{w[k].toFixed(k === "fog" ? 3 : 2)}</span>
                        </span>
                        <input type="range" min={lo} max={hi} step={step} value={w[k]} aria-label={label} className="mt-2 w-full accent-[var(--signal)]" onChange={(e) => patch({ theme: { ...form.theme, world: { ...w, [k]: Number(e.target.value) } } })} />
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field label="Stream URL (YouTube or Twitch, optional)">
                  <input className="input" value={form.streamUrl} placeholder="https://twitch.tv/yourchannel" onChange={(e) => patch({ streamUrl: e.target.value })} />
                </Field>
                <Field label="Opens at (optional launch time)">
                  <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
                  <p className="mt-1.5 text-xs text-faint">Before this time, players see a countdown and can add it to their calendar. Leave empty to open right away.</p>
                </Field>
              </div>
            </section>

            <AnimatePresence initial={false}>
              {form.stages.map((s, i) => (
                <motion.section key={i} id={`stage-${i}`} layout="position" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }} className="mt-12 scroll-mt-24 border-t border-line pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-baseline gap-4">
                      <span className="display text-6xl font-extrabold leading-none" style={{ WebkitTextStroke: "1px rgba(237,232,224,0.3)", color: "transparent" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="display text-3xl font-bold uppercase">Stage</h2>
                    </div>
                    {form.stages.length > 1 && (
                      <button className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-faint hover:text-bad" onClick={() => patch({ stages: form.stages.filter((_, k) => k !== i) })}>
                        <Trash2 size={14} /> Remove stage
                      </button>
                    )}
                  </div>
                  <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_150px]">
                    <Field label="Stage title">
                      <input className="input" value={s.title} onChange={(e) => patchStage(i, { title: e.target.value })} />
                    </Field>
                    <Field label="Players to unlock">
                      <input className="input" type="number" min={1} max={500} value={s.threshold} onChange={(e) => patchStage(i, { threshold: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                    <Field label="Story" wide>
                      <textarea className="input" rows={2} value={s.story} onChange={(e) => patchStage(i, { story: e.target.value })} />
                    </Field>
                  </div>

                  <div className="mt-6 space-y-4">
                    <AnimatePresence initial={false}>
                      {s.missions.map((m, j) => (
                        <motion.div key={j} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="border border-line bg-panel p-5">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="mono text-[11px] tracking-[0.14em] text-faint">M{j + 1}</span>
                            <div role="radiogroup" aria-label="Mission type" className="flex border border-line-strong">
                              {MTYPES.map((t) => (
                                <button
                                  key={t.v}
                                  role="radio"
                                  aria-checked={m.type === t.v}
                                  onClick={() => m.type !== t.v && patchMission(i, j, { ...blankMission(t.v), title: m.title, prompt: m.prompt })}
                                  className={`mono flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${m.type === t.v ? "bg-ink text-bg" : "text-dim hover:text-ink"}`}
                                >
                                  <t.icon size={13} /> {t.label}
                                </button>
                              ))}
                            </div>
                            {s.missions.length > 1 && (
                              <button className="ml-auto text-faint hover:text-bad" aria-label="Remove mission" onClick={() => patchStage(i, { missions: s.missions.filter((_, k) => k !== j) })}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                          <input className="input mt-4 !font-semibold" value={m.title} aria-label="Mission title" onChange={(e) => patchMission(i, j, { title: e.target.value })} />
                          <textarea className="input mt-3" rows={2} value={m.prompt} placeholder="What do players see?" aria-label="Prompt" onChange={(e) => patchMission(i, j, { prompt: e.target.value })} />
                          {m.type !== "vote" && <input className="input mt-3" value={m.answer} placeholder="Correct answer (use | for alternatives)" aria-label="Correct answer" onChange={(e) => patchMission(i, j, { answer: e.target.value })} />}
                          {m.type === "shard" && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {m.shards.map((sh, k) => (
                                <input key={k} className="input" value={sh} aria-label={`Fragment ${k + 1}`} onChange={(e) => patchMission(i, j, { shards: m.shards.map((x, l) => (l === k ? e.target.value : x)) })} />
                              ))}
                              <p className="mono col-span-full text-[10px] uppercase tracking-[0.12em] text-faint">Each player sees only one fragment, so they must talk to solve it.</p>
                            </div>
                          )}
                          {m.type === "vote" && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {m.options.map((o, k) => (
                                <input key={k} className="input" value={o} aria-label={`Option ${k + 1}`} onChange={(e) => patchMission(i, j, { options: m.options.map((x, l) => (l === k ? e.target.value : x)) })} />
                              ))}
                            </div>
                          )}
                          <input className="input mt-3" value={m.hint} placeholder="Hint (optional)" aria-label="Hint" onChange={(e) => patchMission(i, j, { hint: e.target.value })} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {s.missions.length < 4 && (
                      <button className="btn btn-sm" onClick={() => patchStage(i, { missions: [...s.missions, blankMission()] })}>
                        <Plus size={15} /> Add mission
                      </button>
                    )}
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>

            {form.stages.length < 6 && (
              <button className="btn mt-12" onClick={() => patch({ stages: [...form.stages, { title: `Stage ${form.stages.length + 1}`, story: "", threshold: 2, missions: [blankMission()] }] })}>
                <Plus size={16} /> Add stage
              </button>
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-bg/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-8 sm:py-3">
              <div className="min-w-0 basis-full text-xs sm:flex-1 sm:basis-auto">
                {issues.length === 0 ? (
                  <span className="mono hidden text-[10px] uppercase tracking-[0.14em] text-dim sm:inline">Ready. AI drafts are never published without your approval.</span>
                ) : (
                  <span className="flex items-center gap-2 text-warn">
                    <AlertCircle size={14} className="shrink-0" />
                    <span className="truncate">
                      {issues.length} to fix: {issues[0]}
                    </span>
                  </span>
                )}
              </div>
              <button className="btn flex-1 sm:flex-none" disabled={busy || !form.title.trim()} onClick={() => save(false)}>
                Save draft
              </button>
              <button className="btn btn-primary flex-1 sm:flex-none" disabled={busy || issues.length > 0} onClick={() => save(true)}>
                {busy ? "Working…" : (<><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Publish and open rooms</span></>)} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-full" : ""}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
