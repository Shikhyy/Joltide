"use client";
import { useEffect, useState } from "react";
import type { ExperienceView } from "@/lib/types";
import { fmt, useNow } from "./CrewParts";

/**
 * A transparent live HUD for streamers: add this page as a Browser Source in OBS (about 520 x 220).
 * It only reads public state, so it works without signing in.
 */
export default function Overlay({ id }: { id: string }) {
  const [v, setV] = useState<ExperienceView | null>(null);
  const running = Boolean(v?.run?.startedAt && !v.run.completedAt);
  const now = useNow(running);
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    document.body.classList.add("overlay");
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/experiences/${id}`, { cache: "no-store" });
        if (r.ok && !dead) setV(await r.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      dead = true;
      clearInterval(t);
      document.body.classList.remove("overlay");
    };
  }, [id]);
  if (!v) return null;
  const stage = v.stages.find((s) => s.state === "ACTIVE");
  const online = v.members.filter((m) => m.online && m.userId !== "joltideecho").length;
  const pct = v.status === "COMPLETED" ? 100 : stage ? Math.round((stage.finished / stage.threshold) * 100) : 0;
  return (
    <div className="w-[520px] max-w-full p-3 text-ink" style={{ ["--accent" as string]: v.theme.accent }}>
      <div className="border border-white/20 bg-black/70 p-4 backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-3">
          <div className="display truncate text-3xl font-extrabold uppercase leading-none">{v.title}</div>
          <div className="mono shrink-0 text-[11px] uppercase tracking-[0.14em] text-white/70">
            {v.run
              ? v.run.completedAt && v.run.startedAt
                ? `${v.run.crewName} · ${fmt(v.run.completedAt - v.run.startedAt)}`
                : v.run.startedAt
                  ? `${v.run.crewName} · ${fmt(now - v.run.startedAt)}`
                  : `${v.run.crewName} · waiting ${v.members.filter((m) => m.userId !== "joltideecho").length}/${v.run.size}`
              : `${online} online`}
          </div>
        </div>
        <div className="mono mt-3 flex justify-between text-[11px] uppercase tracking-[0.14em] text-white/80">
          <span>{v.status === "COMPLETED" ? "Completed" : stage ? `Stage ${v.currentStage + 1}/${v.stages.length} · ${stage.title}` : ""}</span>
          <span>{stage ? `${stage.finished}/${stage.threshold}` : ""}</span>
        </div>
        <div className="mt-2 h-2 bg-white/15">
          <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
        <ul className="mono mt-3 space-y-1 text-[11px] text-white/70">
          {v.recent.slice(0, 3).map((e) => (
            <li key={e.id} className="truncate">
              / {e.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
