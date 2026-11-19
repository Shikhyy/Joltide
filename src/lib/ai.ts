import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Stage, Theme } from "./types";
import { MOODS, MOOD_COLORS, mission, stage, neonDistrict, sanitizeWorld } from "./templates";

const MissionSchema = z.object({
  type: z.enum(["answer", "shard", "vote"]),
  title: z.string().min(1).max(80),
  prompt: z.string().min(1).max(400),
  answer: z.string().max(60).optional(),
  shards: z.array(z.string().max(80)).max(4).optional(),
  options: z.array(z.string().max(60)).max(4).optional(),
  hint: z.string().max(140).optional(),
});

const GenSchema = z.object({
  title: z.string().min(1).max(60),
  tagline: z.string().min(1).max(140),
  description: z.string().min(1).max(700),
  mood: z.enum(["neon", "ember", "aurora", "void", "toxic"]),
  world: z.record(z.string(), z.unknown()).optional(),
  stages: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        story: z.string().min(1).max(400),
        missions: z.array(MissionSchema).min(1).max(3),
      }),
    )
    .min(2)
    .max(5),
});

export interface Generated {
  title: string;
  tagline: string;
  description: string;
  theme: Theme;
  stages: Stage[];
  generator: "claude" | "fallback";
  note?: string;
}

const SYSTEM = `You design interactive community experiences for JOLTIDE, a platform where a creator's audience plays together in real time.
Return ONLY a JSON object, no prose, matching:
{"title":str,"tagline":str,"description":str,"mood":"neon|ember|aurora|void|toxic","world":{"density":0.5-1,"height":0.5-1.8,"landmarks":0-0.25,"fog":0.006-0.035,"rain":0-1},"stages":[{"title":str,"story":str,"missions":[{"type":"answer|shard|vote","title":str,"prompt":str,"answer":str?,"shards":[str]?,"options":[str]?,"hint":str?}]}]}
Rules:
- 3 or 4 stages. Stage 1 is easy; the last stage is a finale.
- Mission types: "answer" = one short answer (1-2 words, lowercase). "shard" = a collaborative puzzle: give exactly 2 shards like "Fragment A: ORBIT" and "Fragment B: LANTERN"; each player only sees one, so the prompt must tell them to share in chat and combine A then B; "answer" is the combined text. "vote" = 2-3 options, no answer.
- Every answer must be deterministic and solvable from the prompt alone (riddles, ciphers, acrostics, simple logic). Never require outside knowledge or the internet.
- Include at least one shard mission and one vote mission overall.
- "world" shapes the 3D city to match the story: density = how packed the city is, height = tower height, landmarks = chance of tall spires, fog = atmosphere, rain = 0..1. Match the mood (e.g. a haunted coast: low density, heavy fog, few landmarks; a megacity heist: dense, tall, clear).
- Be 100% original. Never use real brands, game titles, characters or people.
- Keep copy punchy and cinematic.`;

export async function generateExperience(prompt: string): Promise<Generated> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallback(prompt, "No ANTHROPIC_API_KEY set. Used the built-in generator.");
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: process.env.JOLTIDE_AI_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: `Creator brief:\n${prompt.slice(0, 600)}` }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const g = GenSchema.parse(JSON.parse(json));
    const [accent, accent2] = MOOD_COLORS[g.mood];
    return {
      title: g.title,
      tagline: g.tagline,
      description: g.description,
      theme: (() => {
        const seed = Math.floor(Math.random() * 90) + 1;
        return { accent, accent2, mood: g.mood, seed, world: sanitizeWorld(g.world as Record<string, unknown> | undefined, seed) };
      })(),
      stages: g.stages.map((s) =>
        stage({
          title: s.title,
          story: s.story,
          threshold: 2,
          missions: s.missions.map((m) =>
            mission({
              type: m.type,
              title: m.title,
              prompt: m.prompt,
              hint: m.hint,
              answer: m.type === "vote" ? undefined : m.answer,
              shards: m.type === "shard" ? m.shards : undefined,
              options: m.type === "vote" ? m.options : undefined,
            }),
          ),
        }),
      ),
      generator: "claude",
    };
  } catch (e) {
    console.error("[ai] generation failed", (e as Error).message);
    return fallback(prompt, "AI generation failed, so the built-in generator was used.");
  }
}

/** Deterministic remix so the product still works with no AI key. */
function fallback(prompt: string, note: string): Generated {
  const base = neonDistrict();
  const words = prompt
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const title = (words.slice(0, 2).join(" ") || "Midnight Signal").toUpperCase();
  const hash = [...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const mood = MOODS[hash % MOODS.length];
  const [accent, accent2] = MOOD_COLORS[mood];
  return {
    title,
    tagline: `A community experience about: ${prompt.slice(0, 80)}`,
    description: `${prompt.slice(0, 300)}\n\n(Draft from the built-in generator. Edit every stage and puzzle before publishing.)`,
    theme: { accent, accent2, mood, seed: (hash % 90) + 1, world: sanitizeWorld(undefined, (hash % 90) + 1) },
    stages: base.stages.map((s) =>
      stage({ ...s, missions: s.missions.map((m) => mission({ ...m })) }),
    ),
    generator: "fallback",
    note,
  };
}
