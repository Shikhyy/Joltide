import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCrewRun, joinExperience, newAggregate, submit, view } from "@/lib/runtime";
import { harborVault } from "@/lib/templates";
import type { Aggregate } from "@/lib/types";

const parent = (): Aggregate => newAggregate({ ...harborVault(), source: "seed" }, { id: "joltide", name: "JOLTIDE" }, { live: true });

let t = 1_800_000_000_000;
beforeEach(() => {
  vi.useFakeTimers();
  t += 120_000;
  vi.setSystemTime(t);
});
afterEach(() => vi.useRealTimers());

const play = async (agg: Aggregate, user: string, missionId: string, content: string) => {
  t += 1000;
  vi.setSystemTime(t);
  return submit(agg, user, missionId, content);
};

/** The correct input for every mission of the current stage, straight from the template. */
const answersFor = (agg: Aggregate) =>
  agg.exp.stages[agg.exp.currentStage].missions.map((m) => ({ id: m.id, content: m.type === "vote" ? m.options![0] : m.answer!.split("|")[0] }));

describe("crew run lobby", () => {
  it("blocks play until the crew is full, then starts the clock", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Night Shift", 3);
    await joinExperience(run, "ann00001", "Ann");
    expect(run.exp.run?.startedAt).toBeUndefined();
    const first = run.exp.stages[0].missions[0].id;
    await expect(play(run, "ann00001", first, "vault")).rejects.toThrow(/crew/i);
    await joinExperience(run, "bob00002", "Bob");
    expect(run.exp.run?.startedAt).toBeUndefined();
    await joinExperience(run, "cat00003", "Cat");
    expect(run.exp.run?.startedAt).toBeTypeOf("number");
    await expect(play(run, "ann00001", first, "vault")).resolves.toMatchObject({ correct: true });
  });

  it("rejects a fourth person joining a crew of three", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Night Shift", 3);
    for (const [id, n] of [["ann00001", "Ann"], ["bob00002", "Bob"], ["cat00003", "Cat"]]) await joinExperience(run, id, n);
    await expect(joinExperience(run, "dan00004", "Dan")).rejects.toThrow(/full/i);
  });

  it("assigns the four heist roles in join order", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Four", 4);
    for (const [id, n] of [["ann00001", "Ann"], ["bob00002", "Bob"], ["cat00003", "Cat"], ["dan00004", "Dan"]]) await joinExperience(run, id, n);
    expect(view(run, "ann00001").members.map((m) => m.role)).toEqual(["Hacker", "Driver", "Inside Man", "Lookout"]);
  });
});

describe("fragments in small crews", () => {
  it("deals round-robin so a crew of two still holds every keypad digit", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Duo", 2);
    await joinExperience(run, "ann00001", "Ann");
    await joinExperience(run, "bob00002", "Bob");
    const mine = (u: string) => view(run, u).stages[0].missions[1].myShard ?? "";
    const all = `${mine("ann00001")} ${mine("bob00002")}`;
    for (const piece of ["Fragment A: 7", "Fragment B: 3", "Fragment C: 9", "Fragment D: 1"]) expect(all).toContain(piece);
    expect(mine("ann00001")).not.toBe(mine("bob00002"));
  });

  it("flags a player who holds no piece in a larger crew", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Four", 4);
    for (const [id, n] of [["ann00001", "Ann"], ["bob00002", "Bob"], ["cat00003", "Cat"], ["dan00004", "Dan"]]) await joinExperience(run, id, n);
    // stage 2's passphrase has only three fragments, so the fourth player holds none
    run.exp.currentStage = 1;
    const m = view(run, "dan00004").stages[1].missions[1];
    expect(m.noFragment).toBe(true);
    expect(view(run, "ann00001").stages[1].missions[1].noFragment).toBe(false);
  });
});

describe("clearing a run", () => {
  it("needs the whole crew, then records the clear time", async () => {
    const run = createCrewRun(parent(), { id: "ann00001", name: "Ann" }, "Duo", 2);
    await joinExperience(run, "ann00001", "Ann");
    await joinExperience(run, "bob00002", "Bob");
    const started = run.exp.run!.startedAt!;
    let guard = 0;
    while (run.exp.status !== "COMPLETED" && guard++ < 10) {
      const stage = run.exp.currentStage;
      for (const a of answersFor(run)) await play(run, "ann00001", a.id, a.content);
      expect(run.exp.currentStage).toBe(stage); // one player is not enough
      for (const a of answersFor(run)) await play(run, "bob00002", a.id, a.content);
    }
    expect(run.exp.status).toBe("COMPLETED");
    expect(run.exp.run!.completedAt! - started).toBeGreaterThan(0);
  });
});

describe("scheduled launch", () => {
  it("rejects play before the start time and allows it after", async () => {
    const p = parent();
    p.exp.startsAt = Date.now() + 60_000;
    await joinExperience(p, "ann00001", "Ann");
    const first = p.exp.stages[0].missions[0].id;
    await expect(play(p, "ann00001", first, "vault")).rejects.toThrow(/started/i);
    t += 61_000;
    vi.setSystemTime(t);
    await expect(play(p, "ann00001", first, "vault")).resolves.toMatchObject({ correct: true });
  });
});
