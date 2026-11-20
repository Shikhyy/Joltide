import { ImageResponse } from "next/og";
import { ensureSeed } from "@/lib/runtime";
import { getAggregate } from "@/lib/store";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A JOLTIDE experience";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSeed();
  const a = await getAggregate(id);
  const live = a && a.exp.status !== "DRAFT";
  const run = live ? a.exp.run : undefined;
  const ms = run?.startedAt && run.completedAt ? run.completedAt - run.startedAt : null;
  const mmss = ms == null ? null : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const title = run ? run.crewName : live ? a.exp.title : "JOLTIDE";
  const tagline = run ? (mmss ? `cleared ${a?.exp.title ?? ""} in ${mmss}` : `is running ${a?.exp.title ?? ""}`) : live ? a.exp.tagline : "Turn moments into movements.";
  const c1 = live ? a.exp.theme.accent : "#ff5a1f";
  const c2 = live ? a.exp.theme.accent2 : "#ffc46b";
  const players = live ? a.members.filter((m) => !m.isBot).length : 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `radial-gradient(900px 500px at 85% 0%, ${c1}55, transparent), radial-gradient(700px 400px at 0% 100%, ${c2}33, transparent), #0a090b`, color: "#ede8e0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#a8a299" }}>
          <div style={{ width: 16, height: 16, background: c1, display: "flex" }} /> {run ? "JOLTIDE · CREW RUN" : "JOLTIDE · LIVE EXPERIENCE"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: title.length > 16 ? 120 : 150, fontWeight: 900, lineHeight: 0.9, textTransform: "uppercase", letterSpacing: -4, display: "flex" }}>{title}</div>
          <div style={{ marginTop: 24, fontSize: 36, color: "#a8a299", display: "flex" }}>{tagline}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#a8a299" }}>
          <div style={{ display: "flex" }}>{run ? "Think your crew is faster? Start your own run." : "Nobody solves it alone. Join with one click, no account."}</div>
          <div style={{ display: "flex", color: c2 }}>{mmss ?? (players > 0 ? `${players} playing` : "Play now")}</div>
        </div>
      </div>
    ),
    size,
  );
}
