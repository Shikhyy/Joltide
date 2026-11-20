"use client";
import { ArrowRight, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCreatorKey, myExperienceIds } from "@/lib/identity";
import { readTaste } from "@/lib/taste";
import type { ExperienceCard } from "@/lib/types";
import RankedRows from "./RankedRows";
import Scene3D from "./Scene3D";

interface Mine {
  id: string;
  title: string;
  status: string;
}

/** The home screen: your own state first (continue, created), then what's live. Real data only. */
export default function Home({ live }: { live: ExperienceCard[] }) {
  const [cont, setCont] = useState<ExperienceCard[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => {
    const t = readTaste();
    setCont(live.filter((c) => c.status === "LIVE" && t.joined.includes(c.id) && !t.completed.includes(c.id)));
    Promise.all(
      myExperienceIds().map(async (id) => {
        const key = getCreatorKey(id);
        if (!key) return null;
        const r = await fetch(`/api/experiences/${id}/draft`, { headers: { "x-creator-key": key } });
        if (!r.ok) return null;
        const j = await r.json();
        return { id, title: j.title as string, status: j.status as string };
      }),
    ).then((l) => setMine(l.filter((x): x is Mine => !!x)));
  }, [live]);

  return (
    <div className="relative isolate">
      <div className="fixed inset-0 -z-10" aria-hidden>
        <Scene3D accent="#ff5a1f" accent2="#ffc46b" seed={7} stages={["COMPLETED", "ACTIVE", "LOCKED", "LOCKED"]} variant="room" />
        <div className="absolute inset-0 bg-bg/80" />
      </div>

      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="display text-5xl font-extrabold uppercase leading-[0.9] sm:text-6xl">Play together. Live.</h1>
            <p className="mt-3 text-dim">Join an experience and solve it with other people in a live room, or create one for your own community.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/studio" className="btn btn-primary">
              <Plus size={16} /> Create an experience
            </Link>
            <Link href="/market" className="btn bg-bg/60 backdrop-blur">
              <Store size={16} /> Store
            </Link>
          </div>
        </header>

        {cont.length > 0 && (
          <section className="mt-12" aria-labelledby="continue">
            <h2 id="continue" className="label">
              Continue
            </h2>
            <ul className="border-t border-line">
              {cont.map((c) => (
                <li key={c.id} className="border-b border-line">
                  <Link href={`/e/${c.id}`} className="group flex items-center justify-between gap-4 py-4">
                    <span className="min-w-0">
                      <span className="display block truncate text-2xl font-bold uppercase leading-none">{c.title}</span>
                      <span className="mono mt-1.5 block text-[10px] uppercase tracking-[0.14em] text-dim">
                        Stage {Math.min(c.currentStage + 1, c.stages)} of {c.stages} · {c.participants} {c.participants === 1 ? "player" : "players"}
                      </span>
                    </span>
                    <span className="btn btn-sm shrink-0 group-hover:border-ink">
                      Continue <ArrowRight size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12" aria-labelledby="live">
          <h2 id="live" className="label">
            Live now
          </h2>
          <div className="border-b border-line">
            <RankedRows cards={live} />
          </div>
        </section>

        {mine.length > 0 && (
          <section className="mt-12" aria-labelledby="mine">
            <h2 id="mine" className="label">
              Your experiences
            </h2>
            <ul className="border-t border-line">
              {mine.map((m) => (
                <li key={m.id} className="border-b border-line">
                  <Link href={`/studio/${m.id}`} className="group flex items-center justify-between gap-4 py-4">
                    <span className="display truncate text-xl font-bold uppercase">{m.title}</span>
                    <span className="mono flex shrink-0 items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-dim">
                      {m.status === "DRAFT" ? "Draft" : m.status === "COMPLETED" ? "Completed" : "Live"}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mono mt-16 flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-faint">
          <Link href="/proof" className="hover:text-ink">
            Usage stats
          </Link>
          <span>Chat powered by Nexconn</span>
        </footer>
      </div>
    </div>
  );
}
