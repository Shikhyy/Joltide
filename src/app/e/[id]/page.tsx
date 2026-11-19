import type { Metadata } from "next";
import ExperienceClient from "@/components/ExperienceClient";
import { ensureSeed } from "@/lib/runtime";
import { getAggregate } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  await ensureSeed();
  const a = await getAggregate(id);
  if (!a || a.exp.status === "DRAFT") return { title: "JOLTIDE" };
  return {
    title: `${a.exp.run ? a.exp.run.crewName + " · " : ""}${a.exp.title} · JOLTIDE`,
    description: a.exp.tagline,
    openGraph: { title: a.exp.title, description: a.exp.tagline, type: "website" },
    twitter: { card: "summary_large_image", title: a.exp.title, description: a.exp.tagline },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExperienceClient id={id} />;
}
