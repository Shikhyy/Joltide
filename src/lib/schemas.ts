import { z } from "zod";
import { USER_ID } from "@/lib/api";
import { mission, stage } from "@/lib/templates";
import type { Stage } from "@/lib/types";

const MissionIn = z
  .object({
    type: z.enum(["answer", "shard", "vote"]),
    title: z.string().min(1).max(80),
    prompt: z.string().min(1).max(500),
    answer: z.string().max(80).optional(),
    shards: z.array(z.string().min(1).max(80)).max(4).optional(),
    options: z.array(z.string().min(1).max(60)).max(4).optional(),
    hint: z.string().max(160).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.type !== "vote" && !m.answer?.trim()) ctx.addIssue({ code: "custom", message: "needs an answer", path: ["answer"] });
    if (m.type === "shard" && (m.shards?.length ?? 0) < 2)
      ctx.addIssue({ code: "custom", message: "needs at least 2 shards", path: ["shards"] });
    if (m.type === "vote" && (m.options?.length ?? 0) < 2)
      ctx.addIssue({ code: "custom", message: "needs at least 2 options", path: ["options"] });
  });

export const CreateBody = z.object({
  userId: z.string().regex(USER_ID),
  userName: z.string().min(1).max(32),
  title: z.string().min(1).max(80),
  tagline: z.string().max(160).default(""),
  description: z.string().max(1200).default(""),
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent2: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    mood: z.enum(["neon", "ember", "aurora", "void", "toxic"]),
    seed: z.number().int().min(1).max(999),
    world: z
      .object({
        density: z.number().min(0.5).max(1),
        height: z.number().min(0.5).max(1.8),
        landmarks: z.number().min(0).max(0.25),
        fog: z.number().min(0.006).max(0.035),
        rain: z.number().min(0).max(1),
      })
      .optional(),
  }),
  stages: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        story: z.string().max(500).default(""),
        threshold: z.number().int().min(1).max(500),
        missions: z.array(MissionIn).min(1).max(4),
      }),
    )
    .min(1)
    .max(6),
  source: z.enum(["ai", "template", "manual"]).default("manual"),
  streamUrl: z.string().url().max(200).optional().or(z.literal("")),
  clonedFrom: z.string().max(40).optional(),
  startsAt: z.number().int().optional(),
  publish: z.boolean().default(false),
});


export type StageInput = z.infer<typeof CreateBody>["stages"];

export function buildStages(input: StageInput, keepIds?: Stage[]): Stage[] {
  return input.map((s, si) => {
    const old = keepIds?.[si];
    const built = stage({
      title: s.title,
      story: s.story,
      threshold: s.threshold,
      missions: s.missions.map((m) =>
        mission({
          type: m.type,
          title: m.title,
          prompt: m.prompt,
          hint: m.hint || undefined,
          answer: m.type === "vote" ? undefined : m.answer,
          shards: m.type === "shard" ? m.shards : undefined,
          options: m.type === "vote" ? m.options : undefined,
        }),
      ),
    });
    return old ? { ...built, id: old.id } : built;
  });
}
