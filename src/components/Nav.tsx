"use client";
import { Volume2, VolumeX, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { play, setSound, useSoundState } from "@/lib/sfx";
import { useAuth } from "./IdentityProvider";

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="display inline-flex items-center gap-1.5 font-extrabold uppercase tracking-tight" style={{ fontSize: size, letterSpacing: "-0.04em" }}>
      <Zap size={size} strokeWidth={2.6} className="text-signal" fill="currentColor" />
      Joltide
    </span>
  );
}

const links = [
  { href: "/", label: "Home" },
  { href: "/market", label: "Store" },
  { href: "/studio", label: "Studio" },
];

function SoundToggle() {
  const on = useSoundState();
  return (
    <button className="text-faint transition-colors hover:text-ink" aria-label={on ? "Mute sound effects" : "Turn on sound effects"} aria-pressed={on} title={on ? "Sound on (click to mute)" : "Sound off (click to turn on)"} onClick={() => { setSound(!on); if (!on) setTimeout(() => play("ok"), 30); }}>
      {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}

export default function Nav() {
  const path = usePathname();
  const { identity, ready, rename } = useAuth();
  if (path.startsWith("/overlay")) return null;
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/75 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5 sm:px-8" aria-label="Main">
        <Link href="/" aria-label="JOLTIDE home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-5 sm:flex">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`mono text-[11px] uppercase tracking-[0.14em] transition-colors ${active ? "text-ink" : "text-faint hover:text-ink"}`}>
                {active && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal" />}
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <SoundToggle />
          {ready && identity && (
            <button className="mono hidden text-[11px] uppercase tracking-[0.12em] text-dim hover:text-ink sm:block" onClick={rename} title="Change display name">
              {identity.name}
            </button>
          )}
          <Link href="/studio" className="btn btn-primary btn-sm">
            Create
          </Link>
        </div>
      </nav>
      <div className="flex gap-4 overflow-x-auto border-t border-line px-5 py-2 sm:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="mono whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-dim">
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
