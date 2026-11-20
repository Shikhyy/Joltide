"use client";
import { useEffect, useState } from "react";
import { rank, readTaste, type Ranked } from "@/lib/taste";
import type { ExperienceCard } from "@/lib/types";
import ExperienceRow from "./ExperienceRow";

/** Renders experiences in server order first (no flash), then re-ranks for this player. */
export default function RankedRows({ cards }: { cards: ExperienceCard[] }) {
  const [state, setState] = useState<{ rows: Ranked[]; personalised: boolean }>({ rows: cards.map((card) => ({ card, score: 0 })), personalised: false });
  useEffect(() => {
    setState(rank(cards, readTaste()));
  }, [cards]);
  return (
    <>
      {state.personalised && state.rows.length > 1 && <p className="mono mb-4 text-[10px] uppercase tracking-[0.16em] text-faint">Sorted for you · based on what you&apos;ve played, stored only in this browser</p>}
      {state.rows.map((r, i) => (
        <ExperienceRow key={r.card.id} c={r.card} index={i} reason={state.rows.length > 1 ? r.reason : undefined} />
      ))}
    </>
  );
}
