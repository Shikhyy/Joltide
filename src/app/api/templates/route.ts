import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { listAggregates } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

// Templates expose structure, never answers.
export const GET = handle(async () => {
  const builtin = TEMPLATES.map((t) => ({
    id: t.id,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    category: t.category,
    theme: t.theme,
    stages: t.stages.length,
    missions: t.stages.reduce((n, s) => n + s.missions.length, 0),
    featured: Boolean(t.featured),
    community: false,
    remixes: 0,
    by: "JOLTIDE",
  }));
  const community = (await listAggregates())
    .filter((a) => a.exp.listedAsTemplate && !a.exp.sandbox && a.exp.status !== "DRAFT")
    .sort((a, b) => (b.exp.remixCount ?? 0) - (a.exp.remixCount ?? 0))
    .map((a) => ({
      id: a.exp.id,
      title: a.exp.title,
      tagline: a.exp.tagline,
      description: a.exp.description,
      category: "Community",
      theme: a.exp.theme,
      stages: a.exp.stages.length,
      missions: a.exp.stages.reduce((n, s) => n + s.missions.length, 0),
      featured: false,
      community: true,
      remixes: a.exp.remixCount ?? 0,
      by: a.exp.creatorName,
    }));
  return NextResponse.json({ templates: [...builtin, ...community] });
});
