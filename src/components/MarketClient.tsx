"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bot, ChevronLeft, ChevronRight, Layers, Play, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setCreatorKey } from "@/lib/identity";
import type { ExperienceCard, Theme } from "@/lib/types";
import { useAuth } from "./IdentityProvider";
import KeyArt from "./KeyArt";

interface Item {
  id: string;
  kind: "play" | "template";
  title: string;
  tagline: string;
  description: string;
  category: string;
  theme: Theme;
  stages: number;
  missions: number | null;
  players: number;
  by: string;
  remixes: number;
  community: boolean;
  status: "LIVE" | "COMPLETED" | null;
}
interface ApiTemplate {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  theme: Theme;
  stages: number;
  missions: number;
  community: boolean;
  remixes: number;
  by: string;
}

const EASE = [0.2, 0.7, 0.2, 1] as const;
const fromCard = (c: ExperienceCard): Item => ({
  id: c.id,
  kind: "play",
  title: c.title,
  tagline: c.tagline,
  description: c.tagline,
  category: c.source === "seed" ? "Original" : c.source === "ai" ? "AI-built" : "Community",
  theme: c.theme,
  stages: c.stages,
  missions: null,
  players: c.participants,
  by: c.creatorName,
  remixes: 0,
  community: c.source !== "seed",
  status: c.status === "COMPLETED" ? "COMPLETED" : "LIVE",
});
const fromTemplate = (t: ApiTemplate): Item => ({ ...t, kind: "template", players: 0, status: null });

type Filter = "all" | "play" | "template" | "remix";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["play", "Play now"],
  ["template", "Templates"],
  ["remix", "Remixes"],
];

export default function MarketClient({ live }: { live: ExperienceCard[] }) {
  const { ensure } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((j: { templates: ApiTemplate[] }) => setTemplates(j.templates.map(fromTemplate)))
      .catch(() => setTemplates([]));
  }, []);

  const play = useMemo(() => live.map(fromCard).sort((a, b) => b.players - a.players), [live]);
  const builtin = useMemo(() => (templates ?? []).filter((t) => !t.community), [templates]);
  const remixes = useMemo(() => (templates ?? []).filter((t) => t.community), [templates]);
  const hero = useMemo(() => {
    const seen = new Set<string>();
    return [...play.slice(0, 2), ...builtin.slice(0, 3), ...remixes.slice(0, 1)].filter((x) => !seen.has(x.title) && !!seen.add(x.title)).slice(0, 5);
  }, [play, builtin, remixes]);

  const cloneTemplate = useCallback(
    async (t: Item) => {
      setBusy(t.id);
      setErr(null);
      try {
        const me = await ensure();
        const r = await fetch(`/api/templates/${t.id}/clone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: me.id, name: me.name }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setCreatorKey(j.id, j.creatorKey);
        router.push(`/studio?edit=${j.id}`);
      } catch (e) {
        setErr((e as Error).message);
        setBusy(null);
      }
    },
    [ensure, router],
  );

  const solo = useCallback(
    async (id: string) => {
      setBusy(`solo${id}`);
      setErr(null);
      try {
        const me = await ensure();
        const r = await fetch(`/api/experiences/${id}/sandbox`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: me.id, name: me.name }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        router.push(`/e/${j.id}`);
      } catch (e) {
        setErr((e as Error).message);
        setBusy(null);
      }
    },
    [ensure, router],
  );

  const primary = (it: Item) => (it.kind === "play" ? router.push(`/e/${it.id}`) : cloneTemplate(it));

  const needle = q.trim().toLowerCase();
  const matches = (it: Item) => !needle || `${it.title} ${it.tagline} ${it.category} ${it.by}`.toLowerCase().includes(needle);
  const shelves: { key: Filter; title: string; sub: string; items: Item[] }[] = [
    { key: "play", title: "Play now", sub: "Live experiences you can join right away", items: play.filter(matches) },
    { key: "template", title: "Start building", sub: "Proven formats. Clone one and make it yours", items: builtin.filter(matches) },
    { key: "remix", title: "Community remixes", sub: "Experiences other creators opened up for remixing", items: remixes.filter(matches) },
  ];
  const visible = shelves.filter((s) => (filter === "all" || filter === s.key) && s.items.length > 0);
  const results = needle ? visible.flatMap((s) => s.items) : [];

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-[1400px] px-5 pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] text-faint">
              <span className="text-signal">JOLTIDE</span> / Store
            </div>
            <h1 className="display mt-2 text-6xl font-extrabold uppercase leading-[0.86] sm:text-8xl">Store</h1>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the store" aria-label="Search the store" />
          </label>
        </div>

        <div role="tablist" aria-label="Browse" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`mono relative whitespace-nowrap px-4 py-3 text-[11px] uppercase tracking-[0.16em] transition-colors ${filter === k ? "text-ink" : "text-faint hover:text-dim"}`}>
              {label}
              {filter === k && <motion.span layoutId="storeTab" className="absolute inset-x-0 -bottom-px h-0.5 bg-signal" />}
            </button>
          ))}
        </div>
        {err && <p role="alert" className="mt-4 text-sm text-bad">{err}</p>}
      </div>

      {!needle && hero.length > 0 && filter === "all" && (
        <div className="mx-auto mt-8 max-w-[1400px] px-5 sm:px-8">
          <Hero items={hero} onOpen={setOpen} onPrimary={primary} busy={busy} />
        </div>
      )}

      <div className="mx-auto mt-12 max-w-[1400px] space-y-14 px-5 sm:px-8">
        {templates === null && <SkeletonShelf />}
        {needle ? (
          <section aria-label="Search results">
            <h2 className="display text-3xl font-bold uppercase">{results.length} result{results.length === 1 ? "" : "s"}</h2>
            {results.length === 0 ? (
              <p className="mt-4 text-sm text-dim">Nothing matches &ldquo;{q}&rdquo;. Try a different word.</p>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {results.map((it) => (
                  <Tile key={`${it.kind}-${it.id}`} it={it} onOpen={setOpen} grid />
                ))}
              </div>
            )}
          </section>
        ) : (
          visible.map((s) => <Shelf key={s.key} title={s.title} sub={s.sub} items={s.items} onOpen={setOpen} />)
        )}
        {templates !== null && !needle && visible.length === 0 && <p className="text-sm text-dim">Nothing here yet.</p>}
      </div>

      <Detail item={open} onClose={() => setOpen(null)} busy={busy} onUse={cloneTemplate} onSolo={solo} />
    </div>
  );
}

/* ------------------------------ hero ------------------------------ */

function Hero({ items, onOpen, onPrimary, busy }: { items: Item[]; onOpen: (i: Item) => void; onPrimary: (i: Item) => void; busy: string | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const it = items[Math.min(i, items.length - 1)];
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setTimeout(() => setI((n) => (n + 1) % items.length), 7000);
    return () => clearTimeout(t);
  }, [i, paused, items.length]);

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative isolate overflow-hidden rounded-2xl border border-line-strong" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} style={{ ["--a" as string]: it.theme.accent }}>
      <div className="relative h-[430px] sm:h-[480px]">
        <AnimatePresence initial={false}>
          <motion.div key={it.id + it.kind} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <KeyArt theme={it.theme} title={it.title} variant="wide" className="h-full w-full" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />

        <div className="absolute inset-y-0 left-0 flex max-w-2xl flex-col justify-end p-6 sm:p-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={it.id + it.kind} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
              <div className="flex flex-wrap items-center gap-2">
                <Badges it={it} />
              </div>
              <h2 className="display mt-4 text-5xl font-extrabold uppercase leading-[0.86] sm:text-7xl">{it.title}</h2>
              <p className="mt-3 max-w-md text-[15px] text-dim">{it.tagline}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={() => onPrimary(it)} disabled={busy === it.id}>
                  {it.kind === "play" ? <Play size={16} fill="currentColor" /> : <Layers size={16} />} {busy === it.id ? "Working…" : it.kind === "play" ? "Play now" : it.community ? "Remix" : "Use template"}
                </button>
                <button className="btn bg-bg/50 backdrop-blur" onClick={() => onOpen(it)}>
                  Details <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <ul className="absolute bottom-5 right-5 top-5 hidden w-60 flex-col justify-end gap-2 lg:flex" aria-label="Up next">
          {items.map((x, k) => (
            <li key={x.id + x.kind}>
              <button onClick={() => setI(k)} aria-current={k === i} className={`group relative flex w-full items-center gap-3 overflow-hidden border bg-bg/70 p-2 text-left backdrop-blur transition-colors ${k === i ? "border-[var(--a)]" : "border-line hover:border-line-strong"}`}>
                <span className="relative block h-11 w-16 shrink-0 overflow-hidden">
                  <KeyArt theme={x.theme} title={x.title} variant="wide" className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="display block truncate text-sm font-bold uppercase leading-tight">{x.title}</span>
                  <span className="mono block text-[9px] uppercase tracking-[0.14em] text-faint">{x.kind === "play" ? "Play now" : x.community ? "Remix" : "Template"}</span>
                </span>
                {k === i && !paused && <span key={`${i}-p`} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--a)]" style={{ animation: "hero-progress 7s linear forwards" }} />}
              </button>
            </li>
          ))}
        </ul>

        <div className="absolute bottom-4 right-5 flex gap-1 lg:hidden">
          <button className="btn btn-sm !px-2" aria-label="Previous" onClick={() => setI((n) => (n - 1 + items.length) % items.length)}>
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-sm !px-2" aria-label="Next" onClick={() => setI((n) => (n + 1) % items.length)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Badges({ it }: { it: Item }) {
  return (
    <>
      {it.status === "LIVE" && (
        <span className="chip !border-[var(--a)] !text-[var(--a)]">
          <span className="blink h-1.5 w-1.5 rounded-full bg-current" /> Live
        </span>
      )}
      {it.status === "COMPLETED" && <span className="chip">Completed</span>}
      {it.kind === "template" && <span className="chip">{it.community ? "Remix" : "Template"}</span>}
      <span className="chip">{it.category}</span>
    </>
  );
}

/* ------------------------------ shelves + tiles ------------------------------ */

function Shelf({ title, sub, items, onOpen }: { title: string; sub: string; items: Item[]; onOpen: (i: Item) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
  // controller-style navigation: left/right arrows move focus tile to tile
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tiles = [...(row.current?.querySelectorAll<HTMLElement>("[data-tile]") ?? [])];
    const at = tiles.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const next = tiles[at + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  };
  return (
    <section aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="display text-3xl font-bold uppercase sm:text-4xl">{title}</h2>
          <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-faint">{sub}</p>
        </div>
        <div className="hidden gap-1 sm:flex">
          <button className="btn btn-sm !px-2" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-sm !px-2" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={row} onKeyDown={onKey} className="no-scrollbar -mx-5 mt-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4 pt-2 sm:-mx-8 sm:px-8">
        {items.map((it) => (
          <Tile key={`${it.kind}-${it.id}`} it={it} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function Tile({ it, onOpen, grid }: { it: Item; onOpen: (i: Item) => void; grid?: boolean }) {
  return (
    <motion.button
      data-tile
      onClick={() => onOpen(it)}
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      aria-label={`${it.title}, ${it.kind === "play" ? "playable experience" : it.community ? "community remix" : "template"}`}
      style={{ ["--a" as string]: it.theme.accent }}
      className={`group relative snap-start overflow-hidden border border-line bg-panel text-left outline-offset-4 transition-shadow hover:shadow-[0_0_0_2px_var(--a),0_26px_70px_-24px_var(--a)] focus-visible:shadow-[0_0_0_2px_var(--a),0_26px_70px_-24px_var(--a)] focus-visible:outline-[3px] focus-visible:outline-white ${grid ? "w-full" : "w-[196px] shrink-0 sm:w-[224px]"}`}
    >
      <div className="relative aspect-[4/5]">
        <KeyArt theme={it.theme} title={it.title} variant="tall" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {it.status === "LIVE" && (
            <span className="mono flex items-center gap-1.5 bg-bg/80 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--a)] backdrop-blur">
              <span className="blink h-1.5 w-1.5 rounded-full bg-current" /> Live
            </span>
          )}
          {it.kind === "template" && <span className="mono bg-bg/80 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-dim backdrop-blur">{it.community ? "Remix" : "Template"}</span>}
          {it.remixes > 0 && <span className="mono bg-bg/80 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-dim backdrop-blur">{it.remixes}× remixed</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/80 to-transparent p-3 pt-10">
          <div className="display text-xl font-bold uppercase leading-[0.95]">{it.title}</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="mono flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-dim">
              {it.kind === "play" ? (
                <>
                  <Users size={11} /> {it.players} playing
                </>
              ) : (
                <>
                  <Layers size={11} /> {it.stages} stages
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function SkeletonShelf() {
  return (
    <div aria-hidden className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="aspect-[4/5] w-[224px] shrink-0 animate-pulse border border-line bg-panel" />
      ))}
    </div>
  );
}

/* ------------------------------ detail ------------------------------ */

function Detail({ item, onClose, busy, onUse, onSolo }: { item: Item | null; onClose: () => void; busy: string | null; onUse: (i: Item) => void; onSolo: (id: string) => void }) {
  const router = useRouter();
  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" />
        {item && (
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92vh] w-[min(94vw,760px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line-strong bg-panel" style={{ ["--a" as string]: item.theme.accent }}>
            <div className="relative aspect-[16/8] w-full">
              <KeyArt theme={item.theme} title={item.title} variant="wide" className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
              <Dialog.Close asChild>
                <button className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-bg/70 backdrop-blur hover:bg-bg" aria-label="Close">
                  <X size={18} />
                </button>
              </Dialog.Close>
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <Badges it={item} />
                </div>
                <Dialog.Title className="display mt-3 text-4xl font-extrabold uppercase leading-[0.88] sm:text-6xl">{item.title}</Dialog.Title>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <Dialog.Description className="max-w-xl text-[15px] leading-relaxed text-dim">{item.description || item.tagline}</Dialog.Description>
              <dl className="mt-6 grid grid-cols-3 gap-px bg-line">
                {[
                  ["Stages", String(item.stages)],
                  [item.kind === "play" ? "Playing" : "Missions", item.kind === "play" ? String(item.players) : String(item.missions ?? "-")],
                  ["By", item.by],
                ].map(([k, v]) => (
                  <div key={k} className="bg-panel p-4">
                    <dt className="label !mb-1">{k}</dt>
                    <dd title={v} className={`display font-bold uppercase leading-tight ${k === "By" ? "line-clamp-2 text-lg" : "truncate text-2xl"}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                {item.kind === "play" ? (
                  <>
                    <button className="btn btn-primary" onClick={() => router.push(`/e/${item.id}`)}>
                      <Play size={16} fill="currentColor" /> Play now
                    </button>
                    <button className="btn" onClick={() => onSolo(item.id)} disabled={busy === `solo${item.id}`} title="A private copy with a labelled demo teammate">
                      <Bot size={16} /> {busy === `solo${item.id}` ? "Setting up…" : "Solo demo"}
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={() => onUse(item)} disabled={busy === item.id}>
                    <Layers size={16} /> {busy === item.id ? "Cloning…" : item.community ? "Remix this" : "Use this template"}
                  </button>
                )}
              </div>
              {item.kind === "template" && item.community && <p className="mt-4 text-xs text-faint">Remixing copies the creator&apos;s puzzles and answers into your own draft.</p>}
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
