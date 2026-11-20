"use client";
import { useEffect, useState } from "react";
import { MOODS } from "./templates";
import type { Theme } from "./types";

/** Hidden disco mode: cycles every world's palette for a few seconds. Returns the current mood, or null. */
export function useDisco(): Theme["mood"] | null {
  const [mood, setMood] = useState<Theme["mood"] | null>(null);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    let to: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      let i = 0;
      clearInterval(iv);
      clearTimeout(to);
      iv = setInterval(() => setMood(MOODS[i++ % MOODS.length]), 650);
      to = setTimeout(() => {
        clearInterval(iv);
        setMood(null);
      }, 7000);
    };
    window.addEventListener("joltide:disco", start);
    return () => {
      window.removeEventListener("joltide:disco", start);
      clearInterval(iv);
      clearTimeout(to);
    };
  }, []);
  return mood;
}
