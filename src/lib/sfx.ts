"use client";
import { useEffect, useState } from "react";

/** Tiny synthesized sound effects. No audio files. Quiet by design, with a visible mute toggle. */
type Kind = "ok" | "bad" | "unlock" | "win" | "ping" | "react";
const KEY = "joltide:sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};
export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event("joltide:sound"));
}
export function useSoundState() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const f = () => setOn(soundOn());
    f();
    window.addEventListener("joltide:sound", f);
    return () => window.removeEventListener("joltide:sound", f);
  }, []);
  return on;
}

function audio() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (!master) {
    // one shared chain: master gain -> gentle compressor -> speakers, so peaks never clip
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers keep audio suspended until the page is clicked or a key is pressed. Call this on the first gesture. */
export function primeAudio() {
  try {
    audio();
  } catch {}
}
if (typeof window !== "undefined") (window as unknown as { __sfx?: () => string }).__sfx = () => ctx?.state ?? "none";

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slideTo?: number) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export function play(kind: Kind) {
  if (typeof window === "undefined" || !soundOn()) return;
  try {
    if (kind === "ok") {
      tone(660, 0, 0.14, "triangle", 0.34);
      tone(990, 0.1, 0.22, "triangle", 0.34);
    } else if (kind === "bad") {
      tone(190, 0, 0.22, "square", 0.16, 120);
    } else if (kind === "ping") {
      tone(1320, 0, 0.12, "sine", 0.22);
    } else if (kind === "react") {
      tone(420, 0, 0.16, "sine", 0.3, 950);
    } else if (kind === "unlock") {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.32));
    } else {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.1, 0.45, "triangle", 0.32));
    }
  } catch {
    /* audio is optional */
  }
}
