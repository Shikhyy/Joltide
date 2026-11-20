"use client";
export const toast = (text: string) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("joltide:toast", { detail: text }));
};
