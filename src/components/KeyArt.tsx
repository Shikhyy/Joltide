"use client";
import { useId, useMemo } from "react";
import type { Theme } from "@/lib/types";

/**
 * Procedural "game cover" art: a night skyline whose palette, density and
 * silhouette come from the experience's own theme + title. No image files.
 */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export default function KeyArt({ theme, title, variant = "tall", className = "" }: { theme: Theme; title: string; variant?: "tall" | "wide"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const W = 400;
  const H = variant === "wide" ? 225 : 500;
  const art = useMemo(() => {
    const r = rng(theme.seed * 977 + hash(title));
    const base = H;
    const maxH = H * (variant === "wide" ? 0.78 : 0.74);
    const towers: { x: number; w: number; h: number; windows: { x: number; y: number; c: number }[]; sign?: { y: number; h: number; c: number } }[] = [];
    let x = -6;
    while (x < W) {
      const w = 12 + r() * 24;
      const landmark = r() > 0.9;
      const h = (landmark ? 0.75 + r() * 0.25 : 0.12 + Math.pow(r(), 1.8) * 0.6) * maxH;
      const windows: { x: number; y: number; c: number }[] = [];
      for (let wy = base - h + 6; wy < base - 4; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (r() > 0.62) windows.push({ x: wx, y: wy, c: r() > 0.7 ? 1 : 0 });
      towers.push({ x, w, h, windows, sign: r() > 0.8 ? { y: base - h * (0.3 + r() * 0.5), h: 10 + r() * 22, c: r() > 0.5 ? 1 : 0 } : undefined });
      x += w + 1 + r() * 3;
    }
    const stars = Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H * 0.45, s: 0.6 + r() * 1.1, o: 0.3 + r() * 0.6 }));
    const beams = [r() * W * 0.8 + W * 0.1, r() * W * 0.8 + W * 0.1].map((x) => ({ x, lean: (r() - 0.5) * 120 }));
    return { stars, beams, towers, moon: { cx: 70 + r() * 260, cy: H * (variant === "wide" ? 0.28 : 0.22), r: 14 + r() * 10 } };
  }, [theme.seed, title, variant, H]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} role="img" aria-label={`${title} cover art`}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05040a" />
          <stop offset="0.5" stopColor={theme.accent} stopOpacity="0.4" />
          <stop offset="1" stopColor={theme.accent} stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={`moon${id}`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor={theme.accent2} stopOpacity="0.9" />
          <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`beam${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={theme.accent2} stopOpacity="0.5" />
          <stop offset="1" stopColor={theme.accent2} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`fade${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#0a090b" stopOpacity="0" />
          <stop offset="1" stopColor="#0a090b" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky${id})`} />
      {art.stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />
      ))}
      {art.beams.map((b, i) => (
        <polygon key={i} points={`${b.x - 6},${H} ${b.x + 6},${H} ${b.x + b.lean + 26},0 ${b.x + b.lean - 26},0`} fill={`url(#beam${id})`} opacity="0.55" />
      ))}
      <circle cx={art.moon.cx} cy={art.moon.cy} r={art.moon.r * 3.2} fill={`url(#moon${id})`} opacity="0.55" />
      <circle cx={art.moon.cx} cy={art.moon.cy} r={art.moon.r} fill="#fff" opacity="0.92" />
      {art.towers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={H - t.h} width={t.w} height={t.h} fill={i % 3 === 0 ? "#1b1727" : "#120f1c"} />
          <rect x={t.x} y={H - t.h} width={t.w} height="1.5" fill={theme.accent2} opacity="0.5" />
          {t.windows.map((w, j) => (
            <rect key={j} x={w.x} y={w.y} width="3.2" height="3.8" fill={w.c ? theme.accent2 : "#ffd9a0"} opacity="0.95" />
          ))}
          {t.sign && <rect x={t.x + t.w - 2} y={t.sign.y} width="2" height={t.sign.h} fill={t.sign.c ? theme.accent : theme.accent2} />}
        </g>
      ))}
      <rect width={W} height={H} fill={`url(#fade${id})`} />
    </svg>
  );
}
