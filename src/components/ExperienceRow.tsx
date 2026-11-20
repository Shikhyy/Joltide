"use client";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ExperienceCard } from "@/lib/types";

export default function ExperienceRow({ c, index, reason }: { c: ExperienceCard; index: number; reason?: string }) {
  const done = c.status === "COMPLETED";
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: index * 0.07 }}>
      <Link
        href={`/e/${c.id}`}
        className="group relative grid items-center gap-x-8 gap-y-2 border-t border-line px-1 py-7 transition-colors hover:bg-white/[0.02] sm:grid-cols-[3rem_minmax(0,1fr)_auto_2rem] sm:py-9"
        style={{ ["--a" as string]: c.theme.accent }}
      >
        <span className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-500 group-hover:scale-y-100" style={{ background: c.theme.accent }} />
        <span className="mono text-[11px] tracking-[0.14em] text-faint">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 transition-transform duration-500 group-hover:translate-x-2">
          <h3 className="display line-clamp-2 break-words text-4xl font-bold uppercase leading-[0.95] sm:text-5xl">{c.title}</h3>
          <p className="mt-2 max-w-xl text-sm text-dim">{c.tagline}</p>
          {reason && <p className="mono mt-2 text-[10px] uppercase tracking-[0.14em]" style={{ color: c.theme.accent2 }}>{reason}</p>}
        </div>
        <div className="flex items-center gap-6 sm:flex-col sm:items-end sm:gap-3">
          <span className="flex gap-1" aria-label={`Stage ${Math.min(c.currentStage + 1, c.stages)} of ${c.stages}`}>
            {Array.from({ length: c.stages }, (_, i) => (
              <span key={i} className="h-1 w-6" style={{ background: done || i < c.currentStage ? c.theme.accent : i === c.currentStage ? c.theme.accent2 : "rgba(237,232,224,0.14)" }} />
            ))}
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">
            {done ? "Completed" : "Live"} · {c.participants} {c.participants === 1 ? "player" : "players"}
          </span>
        </div>
        <ArrowUpRight className="hidden text-faint transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-ink sm:block" size={26} />
      </Link>
    </motion.div>
  );
}
