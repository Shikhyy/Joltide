"use client";

/** Small celebratory bursts in the experience's own colors. Skipped for reduced-motion users. */
export async function burst(colors: string[], kind: "small" | "big" = "small") {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const base = { colors, disableForReducedMotion: true, ticks: 160, gravity: 1.1, scalar: 0.9 };
  if (kind === "small") {
    confetti({ ...base, particleCount: 36, spread: 62, startVelocity: 32, origin: { x: 0.35, y: 0.75 } });
    return;
  }
  const end = Date.now() + 700;
  const tick = () => {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, startVelocity: 55 });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, startVelocity: 55 });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
}
