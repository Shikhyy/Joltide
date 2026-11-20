import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { joinExperience, newAggregate, norm, publish, submit, view } from "@/lib/runtime";
import { mission, stage, NEON_THEME } from "@/lib/templates";
import type { Aggregate } from "@/lib/types";

const build = (): Aggregate => {
  const agg = newAggregate(
    {
      title: "T",
      tagline: "t",
      description: "d",
      theme: NEON_THEME,
      source: "manual",
      stages: [
        stage({ title: "One", story: "s1", threshold: 2, missions: [mission({ type: "answer", title: "A", prompt: "p", answer: "Neon|neon lights" }), mission({ type: "shard", title: "S", prompt: "p", shards: ["Fragment A: VAULT", "Fragment B: 7731"], answer: "vault7731" })] }),
        stage({ title: "Two", story: "SECRET-STORY-2", threshold: 2, missions: [mission({ type: "vote", title: "V", prompt: "p", options: ["Yes", "No"] })] }),
      ],
    },
    { id: "creator1", name: "Creator" },
  );
  return agg;
};

let t = 1_700_000_000_000;
beforeEach(() => {
  vi.useFakeTimers();
  t += 60_000;
  vi.setSystemTime(t);
});
afterEach(() => vi.useRealTimers());

const play = async (agg: Aggregate, user: string, mid: string, content: string) => {
  t += 1000; // clears the per-user throttle
  vi.setSystemTime(t);
  return submit(agg, user, mid, content);
};

describe("answer matching", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(norm("  Vault-7731! ")).toBe("vault7731");
  });
});

describe("progression", () => {
  it("rejects joining a draft, then allows it after publish", async () => {
    const agg = build();
    await expect(joinExperience(agg, "u1aaa", "Ann")).rejects.toThrow(/published/i);
    await publish(agg);
    await expect(joinExperience(agg, "u1aaa", "Ann")).resolves.toBeTruthy();
  });

  it("does not advance on a wrong answer", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    const r = await play(agg, "u1aaa", agg.exp.stages[0].missions[0].id, "nope");
    expect(r.correct).toBe(false);
    expect(agg.exp.currentStage).toBe(0);
  });

  it("blocks submissions from people who haven't joined", async () => {
    const agg = build();
    await publish(agg);
    await expect(play(agg, "ghost1", agg.exp.stages[0].missions[0].id, "neon")).rejects.toThrow(/join/i);
  });

  it("gives different players different clue fragments", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    await joinExperience(agg, "u2bbb", "Bo");
    const a = view(agg, "u1aaa").stages[0].missions[1].myShard;
    const b = view(agg, "u2bbb").stages[0].missions[1].myShard;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("unlocks the next stage only when enough distinct players finish", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    await joinExperience(agg, "u2bbb", "Bo");
    const [m1, m2] = agg.exp.stages[0].missions.map((m) => m.id);
    await play(agg, "u1aaa", m1, "NEON");
    await play(agg, "u1aaa", m2, "vault-7731");
    expect(agg.exp.currentStage).toBe(0); // one player is not enough
    await play(agg, "u2bbb", m1, "neon lights");
    const r = await play(agg, "u2bbb", m2, "VAULT 7731");
    expect(r.stageUnlocked).toBe(true);
    expect(agg.exp.currentStage).toBe(1);
  });

  it("completes the experience after the final stage", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    await joinExperience(agg, "u2bbb", "Bo");
    const [m1, m2] = agg.exp.stages[0].missions.map((m) => m.id);
    for (const u of ["u1aaa", "u2bbb"]) {
      await play(agg, u, m1, "neon");
      await play(agg, u, m2, "vault7731");
    }
    const v = agg.exp.stages[1].missions[0].id;
    await play(agg, "u1aaa", v, "Yes");
    const r = await play(agg, "u2bbb", v, "No");
    expect(r.completed).toBe(true);
    expect(agg.exp.status).toBe("COMPLETED");
  });
});

describe("secrets and votes", () => {
  it("never leaks answers or locked-stage content", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    const json = JSON.stringify(view(agg, "u1aaa"));
    expect(json).not.toMatch(/vault7731/i);
    expect(json).not.toContain("SECRET-STORY-2");
    expect(json).not.toContain(agg.exp.creatorKey);
    expect(view(agg, "u1aaa").stages[1].missions).toEqual([]);
  });

  it("rejects invalid vote options and tallies valid ones", async () => {
    const agg = build();
    await publish(agg);
    await joinExperience(agg, "u1aaa", "Ann");
    await joinExperience(agg, "u2bbb", "Bo");
    const [m1, m2] = agg.exp.stages[0].missions.map((m) => m.id);
    for (const u of ["u1aaa", "u2bbb"]) {
      await play(agg, u, m1, "neon");
      await play(agg, u, m2, "vault7731");
    }
    const v = agg.exp.stages[1].missions[0].id;
    await expect(play(agg, "u1aaa", v, "Maybe")).rejects.toThrow(/option/i);
    await play(agg, "u1aaa", v, "Yes");
    const tally = view(agg, "u1aaa").stages[1].missions[0].tally;
    expect(tally).toEqual({ Yes: 1, No: 0 });
  });
});
