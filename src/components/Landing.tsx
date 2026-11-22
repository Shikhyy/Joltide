"use client";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Clock, Eye, KeyRound, Plus, RotateCcw, Sparkles, Store, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { burst } from "@/lib/confetti";
import { play } from "@/lib/sfx";
import type { ExperienceCard } from "@/lib/types";
import RankedRows from "./RankedRows";
import Scene3D from "./Scene3D";

const TICKER = ["Crew heists", "Four roles", "One clock", "Live chat rooms", "Scheduled drops", "Proof badges", "OBS overlay", "AI world designer", "Remix the store"];

const ROLES = [
  { name: "Hacker", line: "Cracks the lock", icon: KeyRound, shard: "J" },
  { name: "Driver", line: "Owns the route", icon: Clock, shard: "O" },
  { name: "Inside Man", line: "Knows the door", icon: Users, shard: "L" },
  { name: "Lookout", line: "Sees it coming", icon: Eye, shard: "T" },
];

const STEPS = [
  { n: "01", t: "Drop in", d: "Open a live room. Your crew gathers in chat before the clock starts." },
  { n: "02", t: "Split the truth", d: "Every player is dealt different fragments. Nobody holds the whole answer." },
  { n: "03", t: "Talk fast", d: "Share clues, argue, vote. The vault only opens when the crew does it together." },
  { n: "04", t: "Prove it", d: "Beat the clock, climb the leaderboard, keep a signed badge nobody can fake." },
];

const BENTO = [
  { icon: Users, t: "Crew runs", d: "Lobby, roles, a heist clock and a leaderboard. Races other crews for the fastest time." },
  { icon: Clock, t: "Scheduled drops", d: "Open an experience at a set time. The server enforces it, so there are no early peeks." },
  { icon: Sparkles, t: "AI world designer", d: "Describe a vibe. Claude drafts missions, palette and city. Works offline with a built-in generator." },
  { icon: Wrench, t: "Studio", d: "Edit stages, publish, schedule, and watch joins and completions in a dashboard." },
  { icon: Store, t: "Store", d: "Browse, clone and remix experiences from other creators." },
  { icon: Eye, t: "Stream overlay", d: "A transparent OBS page shows your live run to an audience." },
];

const PROMPTS = ["A midnight jewel heist across a rainy harbor", "A school-wide scavenger hunt that ends at the gym", "A haunted library only the night shift can solve"];

function Typed() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const full = PROMPTS[i].length;
    const t = setTimeout(() => (n < full ? setN(n + 1) : (setN(0), setI((i + 1) % PROMPTS.length))), n < full ? 38 : 1800);
    return () => clearTimeout(t);
  }, [n, i, reduce]);
  return (
    <span>
      {reduce ? PROMPTS[0] : PROMPTS[i].slice(0, n)}
      {!reduce && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-signal" />}
    </span>
  );
}

function ShardDemo() {
  const [got, setGot] = useState<boolean[]>([false, false, false, false]);
  const done = got.every(Boolean);
  useEffect(() => {
    if (done) burst(["#ff5a1f", "#ffc46b", "#ede8e0"], "big");
  }, [done]);
  const reveal = (k: number) => {
    play("ok");
    setGot((prev) => prev.map((v, j) => (j === k ? true : v)));
  };
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        {ROLES.map((r, k) => {
          const Icon = r.icon;
          return (
            <motion.button
              key={r.name}
              onClick={() => reveal(k)}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
              className={`relative overflow-hidden rounded-xl border p-5 text-left transition-colors ${got[k] ? "border-signal bg-signal/10" : "border-line bg-panel/70 hover:border-line-strong"}`}
              aria-label={`${r.name}: ${got[k] ? `holds the shard ${r.shard}` : "tap to reveal their shard"}`}
            >
              <Icon size={20} className={got[k] ? "text-signal" : "text-dim"} />
              <div className="display mt-6 text-xl font-bold uppercase leading-none">{r.name}</div>
              <div className="mt-1 text-sm text-dim">{r.line}</div>
              <div className="display mt-5 text-6xl font-extrabold leading-none">
                {got[k] ? (
                  <motion.span initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-block text-signal">
                    {r.shard}
                  </motion.span>
                ) : (
                  <span className="text-faint">?</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="mono text-[11px] uppercase tracking-[0.14em] text-dim" aria-live="polite">
          {done ? "Vault open. Nobody could do it alone." : `${got.filter(Boolean).length} of 4 shards pooled. Tap each role.`}
        </p>
        {done && (
          <button className="btn btn-sm" onClick={() => setGot([false, false, false, false])}>
            <RotateCcw size={14} /> Again
          </button>
        )}
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

function Words({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pr-[0.22em] align-bottom" aria-hidden>
          <motion.span className="inline-block" initial={{ y: "110%", rotate: 6 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 0.9, delay: delay + i * 0.09, ease: [0.2, 0.8, 0.2, 1] }}>
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export default function Landing({ cards }: { cards: ExperienceCard[] }) {
  const { scrollY } = useScroll();
  const veil = useTransform(scrollY, [0, 700], [0.58, 0.9]);
  const lift = useTransform(scrollY, [0, 600], [0, -90]);
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const sx = useSpring(mx, { stiffness: 120, damping: 20 });
  const sy = useSpring(my, { stiffness: 120, damping: 20 });
  const spot = useMotionTemplate`radial-gradient(520px circle at ${sx}px ${sy}px, rgba(255,90,31,0.20), transparent 62%)`;

  const live = cards.filter((c) => c.status === "LIVE");
  const players = cards.reduce((a, c) => a + c.participants, 0);
  const first = live[0];
  const playHref = first ? `/e/${first.id}` : "/play";

  return (
    <div className="relative isolate overflow-x-clip">
      <div className="fixed inset-0 -z-10" aria-hidden>
        <Scene3D accent="#ff5a1f" accent2="#ffc46b" seed={7} stages={["COMPLETED", "ACTIVE", "LOCKED", "LOCKED"]} variant="room" />
        <motion.div className="absolute inset-0 bg-bg" style={{ opacity: veil }} />
      </div>

      <section
        onMouseMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          mx.set(e.clientX - b.left);
          my.set(e.clientY - b.top);
        }}
        className="relative flex min-h-[calc(100svh-56px)] flex-col justify-center px-5 py-16 sm:px-8"
      >
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: spot }} aria-hidden />
        <motion.div style={{ y: lift }} className="relative mx-auto w-full max-w-[1300px]">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mono mb-6 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-dim">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal" />
            {live.length > 0 ? `${live.length} live now · ${players} ${players === 1 ? "player" : "players"} in rooms` : "Multiplayer experiences for communities"}
          </motion.p>
          <h1 className="display text-[clamp(3.2rem,12.5vw,11.5rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.045em]">
            <Words text="Turn moments" />
            <br />
            <Words text="into" delay={0.25} />{" "}
            <Words text="movements." delay={0.34} className="bg-gradient-to-r from-signal via-[#ff8a3d] to-cyan bg-clip-text text-transparent" />
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-8 max-w-xl text-lg text-dim">
            Heists, mysteries and live puzzles that a crew solves together. Everyone holds a different piece. The only way through is to talk.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }} className="mt-9 flex flex-wrap gap-3">
            <Link href={playHref} className="btn btn-primary">
              {first ? `Play ${first.title}` : "Play now"} <ArrowRight size={16} />
            </Link>
            <Link href="/studio" className="btn bg-bg/60 backdrop-blur">
              <Plus size={16} /> Create your own
            </Link>
            <Link href="/market" className="btn bg-bg/60 backdrop-blur">
              <Store size={16} /> Store
            </Link>
          </motion.div>
        </motion.div>
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Scroll
          </motion.span>
        </div>
      </section>

      <div className="overflow-hidden border-y border-line bg-bg/70 py-4 backdrop-blur" aria-hidden>
        <div className="marquee mono text-[11px] uppercase tracking-[0.2em] text-dim">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {TICKER.map((t) => (
                <span key={t + k} className="flex items-center">
                  <span className="px-6">{t}</span>
                  <span className="text-signal">/</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-[1300px] px-5 py-28 sm:px-8" aria-labelledby="how">
        <Reveal>
          <h2 id="how" className="label">How a run goes</h2>
        </Reveal>
        <ol className="mt-6 border-t border-line">
          {STEPS.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 0.05}>
                <div className="group grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-b border-line py-8 sm:grid-cols-[8rem_1fr_1.2fr]">
                  <span className="display text-5xl font-extrabold text-faint transition-colors group-hover:text-signal sm:text-7xl">{s.n}</span>
                  <span className="display text-3xl font-extrabold uppercase leading-none sm:text-5xl">{s.t}</span>
                  <p className="col-span-2 max-w-md text-dim sm:col-span-1">{s.d}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-panel/60 py-28 backdrop-blur" aria-labelledby="try">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8">
          <Reveal>
            <h2 id="try" className="label">Try the mechanic</h2>
            <p className="display mt-4 max-w-3xl text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">Four people. Four shards. One vault.</p>
            <p className="mt-4 max-w-xl text-dim">This is how every crew run works. Each role holds a different fragment, and the code only exists once the crew pools them. Tap each role to see it happen.</p>
          </Reveal>
          <div className="mt-10">
            <ShardDemo />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1300px] px-5 py-28 sm:px-8" aria-labelledby="built">
        <Reveal>
          <h2 id="built" className="label">Everything in the box</h2>
        </Reveal>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.t} delay={(i % 3) * 0.06}>
                <motion.div whileHover={{ y: -4 }} className="h-full rounded-xl border border-line bg-panel/70 p-6 backdrop-blur transition-colors hover:border-signal/60">
                  <Icon size={20} className="text-signal" />
                  <h3 className="display mt-8 text-2xl font-bold uppercase leading-none">{b.t}</h3>
                  <p className="mt-3 text-sm text-dim">{b.d}</p>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {cards.length > 0 && (
        <section className="mx-auto max-w-[1300px] px-5 pb-28 sm:px-8" aria-labelledby="now">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <h2 id="now" className="label">Live now</h2>
              <Link href="/play" className="mono text-[11px] uppercase tracking-[0.14em] text-dim hover:text-ink">All experiences →</Link>
            </div>
            <div className="border-b border-line">
              <RankedRows cards={cards.slice(0, 3)} />
            </div>
          </Reveal>
        </section>
      )}

      <section className="border-y border-line bg-panel/60 py-28 backdrop-blur" aria-labelledby="make">
        <div className="mx-auto grid max-w-[1300px] gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <Reveal>
            <h2 id="make" className="label">For creators</h2>
            <p className="display mt-4 text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">Describe a vibe. Ship a world.</p>
            <p className="mt-4 max-w-md text-dim">Type an idea and the designer drafts the stages, the missions and the look. You edit, schedule and publish. Then your community plays.</p>
            <Link href="/studio" className="btn btn-primary mt-8">
              Open the studio <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-xl border border-line bg-bg/80 p-6">
              <div className="label">Example prompt</div>
              <p className="display mt-3 min-h-[5.5rem] text-2xl font-bold leading-tight sm:text-3xl" aria-live="off">
                <Typed />
              </p>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                {["Stages", "Missions", "Palette", "City layout", "Roles"].map((c) => (
                  <span key={c} className="mono rounded-full border border-line-strong px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-dim">{c}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative px-5 py-40 text-center sm:px-8">
        <Reveal>
          <p className="display mx-auto max-w-[16ch] text-[clamp(2.8rem,9vw,8rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.04em]">
            Nobody wins <span className="text-signal">alone.</span>
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href={playHref} className="btn btn-primary">
              Start a run <ArrowRight size={16} />
            </Link>
            <Link href="/studio" className="btn bg-bg/60 backdrop-blur">
              <Plus size={16} /> Create an experience
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="mono border-t border-line bg-bg/80 px-5 py-6 text-[10px] uppercase tracking-[0.14em] text-faint backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1300px] flex-wrap gap-x-6 gap-y-2">
          <Link href="/play" className="hover:text-ink">Play</Link>
          <Link href="/market" className="hover:text-ink">Store</Link>
          <Link href="/studio" className="hover:text-ink">Studio</Link>
          <Link href="/proof" className="hover:text-ink">Usage stats</Link>
          <span className="sm:ml-auto">Chat powered by Nexconn</span>
        </div>
      </footer>
    </div>
  );
}
