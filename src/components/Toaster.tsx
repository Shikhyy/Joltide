"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { play, primeAudio } from "@/lib/sfx";
import { toast } from "@/lib/toast";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Global toasts + the hidden Konami code (up up down down left right left right B A). */
export default function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  const idx = useRef(0);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const id = ++n;
      setItems((p) => [...p.slice(-2), { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3200);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      idx.current = k === KONAMI[idx.current] ? idx.current + 1 : k === KONAMI[0] ? 1 : 0;
      if (idx.current === KONAMI.length) {
        idx.current = 0;
        window.dispatchEvent(new Event("joltide:disco"));
        toast("Disco mode unlocked");
        play("win");
      }
    };
    window.addEventListener("pointerdown", primeAudio, { once: true });
    window.addEventListener("keydown", primeAudio, { once: true });
    window.addEventListener("joltide:toast", onToast);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("joltide:toast", onToast);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[95] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }} className="mono flex items-center gap-2 border border-signal bg-bg/95 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-ink backdrop-blur">
            <Zap size={13} className="text-signal" fill="currentColor" /> {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
