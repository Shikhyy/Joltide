import { describe, expect, it } from "vitest";
import { issueBadge, verifyBadge } from "@/lib/badge";
import { levelOf, rank, xpOf } from "@/lib/taste";
import { deriveWorld, sanitizeWorld } from "@/lib/templates";
import type { ExperienceCard } from "@/lib/types";

const payload = { v: 1 as const, e: "abc", t: "NEON DISTRICT", n: "Nova", a: 1_700_000_000_000, s: 4, c: "#ff3d81" };

describe("verifiable badges", () => {
  it("round-trips a signed badge", () => {
    expect(verifyBadge(issueBadge(payload))).toEqual(payload);
  });
  it("rejects a tampered payload", () => {
    const [body, sig] = issueBadge(payload).split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, n: "Someone Else" })).toString("base64url");
    expect(verifyBadge(`${forged}.${sig}`)).toBeNull();
    expect(verifyBadge(`${body}.AAAA`)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(verifyBadge("nope")).toBeNull();
    expect(verifyBadge("")).toBeNull();
    expect(verifyBadge("a.b.c")).toBeNull();
  });
});

describe("world parameters", () => {
  it("derives different shapes from different seeds, always within range", () => {
    const a = deriveWorld(7);
    const b = deriveWorld(45);
    expect(a).not.toEqual(b);
    for (const w of [a, b]) {
      expect(w.density).toBeGreaterThanOrEqual(0.5);
      expect(w.density).toBeLessThanOrEqual(1);
      expect(w.height).toBeLessThanOrEqual(1.8);
      expect(w.fog).toBeGreaterThanOrEqual(0.006);
    }
  });
  it("clamps wild AI output and fills missing values", () => {
    const w = sanitizeWorld({ density: 99, height: -5, fog: "foggy", rain: 0.4 }, 7);
    expect(w.density).toBe(1);
    expect(w.height).toBe(0.5);
    expect(w.fog).toBe(deriveWorld(7).fog);
    expect(w.rain).toBe(0.4);
  });
});

const card = (id: string, mood: ExperienceCard["theme"]["mood"], participants = 0, status: ExperienceCard["status"] = "LIVE"): ExperienceCard => ({
  id, title: id, tagline: "", theme: { accent: "#000", accent2: "#fff", mood, seed: 1 }, status, creatorName: "x", participants, stages: 3, currentStage: 0, source: "manual",
});

describe("personalization", () => {
  const cards = [card("a", "neon"), card("b", "ember"), card("c", "ember", 5)];
  it("keeps server order when there is no history", () => {
    const { rows, personalised } = rank(cards, { joined: [], completed: [], moods: {}, solved: 0 });
    expect(personalised).toBe(false);
    expect(rows.map((r) => r.card.id)[0]).toBe("c"); // busiest first
  });
  it("floats in-progress and favourite-mood experiences, and sinks finished ones", () => {
    const t = { joined: ["a", "z"], completed: ["z"], moods: { ember: 3 }, solved: 0 };
    const { rows, personalised } = rank(cards, t);
    expect(personalised).toBe(true);
    expect(rows[0].card.id).toBe("a"); // joined and unfinished
    expect(rows.find((r) => r.card.id === "b")?.reason).toMatch(/ember/);
    const done = rank([card("z", "neon"), card("y", "neon")], t).rows;
    expect(done[done.length - 1].card.id).toBe("z");
  });
});

describe("xp and levels", () => {
  it("scores joins, finishes and solves", () => {
    expect(xpOf({ joined: ["a", "b"], completed: ["a"], moods: {}, solved: 3 })).toBe(20 + 50 + 45);
  });
  it("starts at level 1 and levels up monotonically with sensible titles", () => {
    expect(levelOf(0)).toMatchObject({ level: 1, title: "Rookie", progress: 0 });
    let prev = 0;
    for (const xp of [0, 24, 25, 99, 100, 400, 900, 5000]) {
      const l = levelOf(xp);
      expect(l.level).toBeGreaterThanOrEqual(prev);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThan(1);
      prev = l.level;
    }
    expect(levelOf(5000).title).toBe("Legend"); // caps at the last title
  });
});
