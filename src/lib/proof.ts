import { listAggregates, waitlistCount } from "./store";
import { ensureSeed, srcName } from "./runtime";

/** Aggregate, anonymised usage numbers. No names, ids or message content. */
export async function proofSummary() {
  await ensureSeed();
  const all = (await listAggregates()).filter((a) => a.exp.status !== "DRAFT" && !a.exp.sandbox);
  const humans = all.flatMap((a) => a.members.filter((m) => !m.isBot).map((m) => ({ ...m, exp: a.exp.id })));
  const human = new Set(humans.map((h) => h.userId));
  const subs = all.flatMap((a) => a.submissions.filter((s) => human.has(s.userId)));
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const days: Record<string, number> = {};
  for (const h of humans) days[day(h.joinedAt)] = (days[day(h.joinedAt)] ?? 0) + 1;
  const timeline = Object.entries(days).sort().slice(-14).map(([date, joins]) => ({ date, joins }));
  return {
    generatedAt: new Date().toISOString(),
    experiences: all.filter((a) => !a.exp.run).length,
    uniquePlayers: human.size,
    joins: humans.length,
    submissions: subs.length,
    correctSubmissions: subs.filter((s) => s.correct).length,
    waitlist: await waitlistCount(),
    stageUnlocks: all.reduce((n, a) => n + a.events.filter((e) => e.type === "stage_unlocked").length, 0),
    completions: all.filter((a) => a.exp.status === "COMPLETED").length,
    sources: Object.entries(humans.reduce<Record<string, number>>((o, h) => ((o[srcName(h.ref)] = (o[srcName(h.ref)] ?? 0) + 1), o), {})).map(([ref, joins]) => ({ ref, joins })).sort((a, b) => b.joins - a.joins),
    timeline,
    perExperience: all.filter((a) => !a.exp.run).map((a) => ({ title: a.exp.title, players: a.members.filter((m) => !m.isBot).length, stage: a.exp.status === "COMPLETED" ? a.exp.stages.length : a.exp.currentStage + 1, stages: a.exp.stages.length, status: a.exp.status })),
  };
}
