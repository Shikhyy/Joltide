"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarPlus, Check, Clock, Copy, Swords, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ExperienceView } from "@/lib/types";
import { useAuth } from "./IdentityProvider";

export const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}

const CREW_NAMES = ["Night Shift", "Quiet Hands", "Last Call", "Static", "Blackout", "Low Tide", "Back Alley", "Paper Moon"];

/** Button + dialog: start a private crew run of this experience. */
export function CrewStart({ expId }: { expId: string }) {
  const { ensure } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => CREW_NAMES[Math.floor(Math.random() * CREW_NAMES.length)]);
  const [size, setSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const me = await ensure();
      const r = await fetch(`/api/experiences/${expId}/crew`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: me.id, name: me.name, crewName: name, size }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push(`/e/${j.id}`);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn btn-sm">
          <Swords size={14} /> Start a crew run
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 border border-line-strong bg-panel p-7">
          <form onSubmit={start}>
            <span className="label">Crew run</span>
            <Dialog.Title className="display text-4xl font-bold uppercase leading-[0.92]">Race the clock with friends</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-dim">A private copy for your crew. Everyone gets a role. The clock starts when the last person joins, and fast crews land on the leaderboard.</Dialog.Description>
            <label className="label mt-6" htmlFor="crew-name">
              Crew name
            </label>
            <input id="crew-name" className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
            <span className="label mt-5">Crew size</span>
            <div role="radiogroup" aria-label="Crew size" className="flex border border-line-strong">
              {[2, 3, 4].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)} className={`mono flex-1 px-3 py-3 text-xs uppercase tracking-[0.14em] transition-colors ${size === n ? "bg-ink text-bg" : "text-dim hover:text-ink"}`}>
                  {n} players
                </button>
              ))}
            </div>
            {err && (
              <p role="alert" className="mt-3 text-xs text-bad">
                {err}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-sm">
                  Cancel
                </button>
              </Dialog.Close>
              <button className="btn btn-primary btn-sm" disabled={busy || name.trim().length < 2}>
                {busy ? "Creating…" : "Create crew"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Lobby while the crew assembles, then the heist clock, then the final time. */
export function RunBanner({ view, uid }: { view: ExperienceView; uid?: string }) {
  const run = view.run!;
  const humans = view.members.filter((m) => m.userId !== "joltideecho");
  const running = Boolean(run.startedAt && !run.completedAt);
  const now = useNow(running);
  const [copied, setCopied] = useState(false);
  const me = humans.find((m) => m.userId === uid);

  return (
    <section className="sheet p-5 sm:p-6" aria-label="Crew run">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="label !mb-1">Crew run · {run.crewName}</span>
          {run.completedAt && run.startedAt ? (
            <div className="display text-5xl font-extrabold uppercase leading-none" style={{ color: "var(--accent)" }}>
              Cleared in {fmt(run.completedAt - run.startedAt)}
            </div>
          ) : run.startedAt ? (
            <div className="display flex items-center gap-3 text-5xl font-extrabold leading-none tabular-nums">
              <Clock size={30} style={{ color: "var(--accent)" }} /> {fmt(now - run.startedAt)}
            </div>
          ) : (
            <div className="display text-4xl font-extrabold uppercase leading-none">
              Waiting for your crew <span className="text-dim">{humans.length}/{run.size}</span>
            </div>
          )}
        </div>
        {!run.startedAt && (
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}${location.pathname}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Invite link copied" : "Copy invite link"}
          </button>
        )}
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: run.size }, (_, i) => {
          const m = humans[i];
          return (
            <li key={i} className={`border px-3 py-2.5 text-sm ${m ? "border-line-strong" : "border-dashed border-line text-faint"}`}>
              <div className="mono text-[9px] uppercase tracking-[0.18em] text-faint">{["Hacker", "Driver", "Inside Man", "Lookout"][i % 4]}</div>
              <div className="mt-0.5 flex items-center gap-2 font-semibold">
                {m ? (
                  <>
                    <span className="h-2 w-2" style={{ background: m.color }} /> {m.name}
                    {m.userId === uid && <span className="mono text-[9px] uppercase tracking-[0.14em] text-faint">you</span>}
                  </>
                ) : (
                  <span className="flex items-center gap-2 font-normal">
                    <Users size={13} /> Open slot
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {me && !run.startedAt && <p className="mt-4 text-xs text-dim">You&apos;re the {me.role}. The heist starts as soon as everyone is in.</p>}
    </section>
  );
}

const ics = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Countdown to a scheduled launch, with an add-to-calendar file. */
export function LaunchBanner({ startsAt, title }: { startsAt: number; title: string }) {
  const [now, setNow] = useState(() => Date.now());
  const waiting = now < startsAt;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);
  if (!waiting) return null;
  const left = Math.floor((startsAt - now) / 1000);
  const parts: [number, string][] = [
    [Math.floor(left / 86400), "days"],
    [Math.floor((left % 86400) / 3600), "hrs"],
    [Math.floor((left % 3600) / 60), "min"],
    [left % 60, "sec"],
  ];
  const download = () => {
    const url = `${location.origin}${location.pathname}`;
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JOLTIDE//EN", "BEGIN:VEVENT", `UID:${location.pathname.replace(/\W/g, "")}@joltide`, `DTSTAMP:${ics(new Date().toISOString())}`, `DTSTART:${ics(new Date(startsAt).toISOString())}`, `DTEND:${ics(new Date(startsAt + 3600_000).toISOString())}`, `SUMMARY:${title.replace(/[,;\n]/g, " ")}`, `DESCRIPTION:Join here: ${url}`, `URL:${url}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "joltide-launch.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="sheet flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Launch countdown">
      <div>
        <span className="label !mb-1">Opens {new Date(startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
        <div className="flex gap-5" role="timer">
          {parts.map(([n, l]) => (
            <div key={l}>
              <div className="display text-4xl font-extrabold leading-none tabular-nums">{String(n).padStart(2, "0")}</div>
              <div className="mono mt-1 text-[9px] uppercase tracking-[0.18em] text-faint">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <button className="btn" onClick={download}>
        <CalendarPlus size={15} /> Add to calendar
      </button>
    </section>
  );
}

/** Fastest completed crews for this experience. */
export function Leaderboard({ expId, refreshKey }: { expId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<{ runId: string; crew: string; size: number; ms: number; players: string[] }[] | null>(null);
  useEffect(() => {
    fetch(`/api/experiences/${expId}/leaderboard`)
      .then((r) => r.json())
      .then((j) => setRows(j.entries))
      .catch(() => setRows([]));
  }, [expId, refreshKey]);
  return (
    <div className="sheet p-5">
      <h3 className="label flex items-center gap-2">
        <Trophy size={12} /> Fastest crews
      </h3>
      {rows === null ? (
        <p className="text-xs text-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-dim">No crew has finished yet. Start a crew run and set the first time.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.runId} className="flex items-center gap-3 text-sm">
              <span className="mono w-5 text-[11px] text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.crew}</span>
                <span className="block truncate text-[11px] text-faint">{r.players.join(", ")}</span>
              </span>
              <span className="display text-xl font-bold tabular-nums" style={{ color: i === 0 ? "var(--accent)" : undefined }}>
                {fmt(r.ms)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
