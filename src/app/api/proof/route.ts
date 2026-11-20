import { NextResponse } from "next/server";
import { proofSummary } from "@/lib/proof";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await proofSummary();
  if (new URL(req.url).searchParams.get("format") !== "csv") return NextResponse.json(s);
  const rows = [["metric", "value"], ["generated_at", s.generatedAt], ["experiences", s.experiences], ["unique_players", s.uniquePlayers], ["submissions", s.submissions], ["correct_submissions", s.correctSubmissions], ["stage_unlocks", s.stageUnlocks], ["completions", s.completions], ["pro_waitlist", s.waitlist], ...s.timeline.map((t) => [`joins_${t.date}`, t.joins]), ...s.sources.map((x) => [`source_${x.ref}`, x.joins])];
  return new NextResponse(rows.map((r) => r.join(",")).join("\n"), { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="joltide-usage.csv"' } });
}
