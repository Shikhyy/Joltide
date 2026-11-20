import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JOLTIDE: turn moments into movements";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 72, background: "radial-gradient(900px 500px at 85% 0%, #ff5a1f66, transparent), #0a090b", color: "#ede8e0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 900, lineHeight: 0.88, textTransform: "uppercase", letterSpacing: -5, flexDirection: "column" }}>
          <span style={{ display: "flex" }}>Turn moments</span>
          <span style={{ display: "flex" }}>into</span>
          <span style={{ display: "flex", color: "#ff5a1f" }}>movements.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#a8a299", display: "flex" }}>JOLTIDE · AI-built worlds your audience plays together, live.</div>
      </div>
    ),
    size,
  );
}
