import { ImageResponse } from "next/og";
import { verifyBadge } from "@/lib/badge";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JOLTIDE verified completion badge";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const p = verifyBadge((await params).token);
  const c = p?.c ?? "#ff5a1f";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `radial-gradient(900px 500px at 90% 0%, ${c}66, transparent), #0a090b`, color: "#ede8e0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: c }}>{p ? "Verified completion badge" : "JOLTIDE"}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 140, fontWeight: 900, lineHeight: 0.9, textTransform: "uppercase", letterSpacing: -4 }}>{p?.n ?? "JOLTIDE"}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 40, color: "#a8a299" }}>{p ? `helped unlock ${p.t}` : "Turn moments into movements."}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#6e6961" }}>Signed by JOLTIDE · Nobody solves it alone</div>
      </div>
    ),
    size,
  );
}
