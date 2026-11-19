import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ExperienceCard as Card } from "@/lib/types";

export default function ExperienceCard({ c, href }: { c: Card; href?: string }) {
  const done = c.status === "COMPLETED";
  return (
    <Link href={href ?? `/e/${c.id}`} className="group relative block overflow-hidden border border-line bg-panel p-6 transition-colors hover:border-line-strong">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: c.theme.accent }} />
      <div className="mono flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-dim">
        <span style={{ color: c.theme.accent }}>{done ? "Completed" : "Live"}</span>
        <span>{c.source === "ai" ? "AI-built" : c.source === "seed" ? "Featured" : "Community"}</span>
      </div>
      <h3 className="display mt-5 text-3xl font-bold uppercase leading-[0.95]">{c.title}</h3>
      <p className="mt-2 line-clamp-2 min-h-[2.6em] text-sm text-dim">{c.tagline}</p>
      <div className="mt-6 flex items-center justify-between">
        <span className="flex gap-1">
          {Array.from({ length: c.stages }, (_, i) => (
            <span key={i} className="h-1 w-5" style={{ background: done || i < c.currentStage ? c.theme.accent : i === c.currentStage ? c.theme.accent2 : "rgba(237,232,224,0.14)" }} />
          ))}
        </span>
        <span className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-dim">
          {c.participants} {c.participants === 1 ? "player" : "players"}
          <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
