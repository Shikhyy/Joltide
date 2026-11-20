import { BadgeCheck, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { verifyBadge } from "@/lib/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const p = verifyBadge((await params).token);
  if (!p) return { title: "Badge · JOLTIDE" };
  return { title: `${p.n} helped unlock ${p.t} · JOLTIDE`, description: `Verified completion badge for ${p.t}.`, twitter: { card: "summary_large_image" } };
}

export default async function BadgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = verifyBadge(token);
  if (!p)
    return (
      <div className="mx-auto max-w-md px-5 py-28 text-center">
        <ShieldAlert className="mx-auto text-bad" size={36} />
        <h1 className="display mt-4 text-5xl font-bold uppercase leading-[0.9]">Not verified</h1>
        <p className="mt-3 text-sm text-dim">This badge link is invalid or has been altered, so it can&apos;t be verified.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Go to JOLTIDE
        </Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl px-5 py-20" style={{ ["--accent" as string]: p.c }}>
      <div className="relative overflow-hidden border border-line-strong bg-panel p-8 sm:p-12">
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.c }} />
        <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: p.c }}>
          <BadgeCheck size={16} /> Verified completion badge
        </div>
        <h1 className="display mt-6 text-6xl font-extrabold uppercase leading-[0.88] sm:text-7xl">{p.n}</h1>
        <p className="mt-4 text-lg text-dim">
          helped the community unlock <span className="text-ink">{p.t}</span> across {p.s} stage{p.s === 1 ? "" : "s"}.
        </p>
        <p className="mono mt-8 text-[11px] uppercase tracking-[0.14em] text-faint">Issued {new Date(p.a).toUTCString()}</p>
      </div>
      <p className="mt-6 text-center text-xs text-faint">This credential is cryptographically signed by JOLTIDE. Altering the link invalidates it.</p>
      <div className="mt-8 text-center">
        <Link href={`/e/${p.e}`} className="btn btn-primary">
          Play {p.t}
        </Link>
      </div>
    </div>
  );
}
