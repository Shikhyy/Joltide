"use client";
import type { ExperienceCard } from "./types";

/**
 * Lightweight personalization. Signals never leave the browser:
 * what you joined, what you finished, and which worlds you gravitate to.
 */
interface Taste {
  joined: string[];
  completed: string[];
  moods: Record<string, number>;
  solved: number;
}
const KEY = "joltide:taste";

export function readTaste(): Taste {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Taste>;
    return { joined: t.joined ?? [], completed: t.completed ?? [], moods: t.moods ?? {}, solved: t.solved ?? 0 };
  } catch {
    return { joined: [], completed: [], moods: {}, solved: 0 };
  }
}

export const TITLES = ["Rookie", "Scout", "Decoder", "Detective", "Strategist", "Mastermind", "Legend"];
export const xpOf = (t: Taste) => t.joined.length * 10 + t.completed.length * 50 + t.solved * 15;
export function levelOf(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 25)) + 1;
  const floor = (level - 1) ** 2 * 25;
  const next = level ** 2 * 25;
  return { level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], progress: (xp - floor) / (next - floor) };
}

function save(t: Taste, before: number) {
  localStorage.setItem(KEY, JSON.stringify(t));
  void before;
  window.dispatchEvent(new Event("joltide:xp"));
}

/** Called when you solve a mission. */
export function recordSolve() {
  try {
    const t = readTaste();
    const before = xpOf(t);
    t.solved += 1;
    save(t, before);
  } catch {}
}

export function recordVisit(id: string, mood: string, joined: boolean, completed: boolean) {
  if (!joined) return;
  try {
    const t = readTaste();
    const before = xpOf(t);
    if (!t.joined.includes(id)) {
      t.joined.push(id);
      t.moods[mood] = (t.moods[mood] ?? 0) + 1;
    }
    if (completed && !t.completed.includes(id)) {
      t.completed.push(id);
      t.moods[mood] = (t.moods[mood] ?? 0) + 2;
    }
    save(t, before);
  } catch {}
}

export interface Ranked {
  card: ExperienceCard;
  reason?: string;
  score: number;
}

export function rank(cards: ExperienceCard[], t: Taste): { rows: Ranked[]; personalised: boolean } {
  const top = Object.entries(t.moods).sort((a, b) => b[1] - a[1])[0]?.[0];
  const personalised = t.joined.length > 0;
  const rows = cards.map((card, i): Ranked => {
    const parts: [number, string | undefined][] = [];
    const joined = t.joined.includes(card.id);
    const done = t.completed.includes(card.id) || card.status === "COMPLETED";
    if (joined && !done) parts.push([5, "Pick up where you left off"]);
    if (done && joined) parts.push([-3, "You finished this one"]);
    if (!joined && top && card.theme.mood === top) parts.push([2, `Because you like ${top} worlds`]);
    if (!joined) parts.push([1, "New for you"]);
    if (card.participants > 0) parts.push([Math.min(2, card.participants / 3), `${card.participants} ${card.participants === 1 ? "player" : "players"} in it now`]);
    if (card.source === "ai") parts.push([0.5, "AI-designed"]);
    const score = parts.reduce((n, [v]) => n + v, 0) - i * 0.01; // stable tie-break by server order
    const best = [...parts].sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))[0];
    return { card, score, reason: best?.[1] };
  });
  rows.sort((a, b) => b.score - a.score);
  return { rows, personalised };
}
