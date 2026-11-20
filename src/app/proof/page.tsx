import { Download } from "lucide-react";
import { proofSummary } from "@/lib/proof";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proof of usage · JOLTIDE", description: "Live, anonymised numbers from real JOLTIDE players." };

export default async function Proof() {
  const s = await proofSummary();
  const max = Math.max(1, ...s.timeline.map((t) => t.joins));
  const kpi: [string, number][] = [
    ["Unique players", s.uniquePlayers],
    ["Live experiences", s.experiences],
    ["Missions submitted", s.submissions],
    ["Stage unlocks", s.stageUnlocks],
    ["Creators on Pro waitlist", s.waitlist],
  ];
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-14 sm:px-8">
      <div className="mono flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-faint">
        <span className="text-signal">Proof</span>
        <span className="h-px w-10 bg-line-strong" /> Live, anonymised, no names or messages
      </div>
      <h1 className="display mt-5 text-6xl font-extrabold uppercase leading-[0.88] sm:text-8xl">Real people. Real rooms.</h1>
      <p className="mt-5 max-w-2xl text-dim">Every number below is computed live from the JOLTIDE database. Each player connects through the Nexconn Chat SDK, so they also count as active Nexconn users.</p>

      <div className="mt-12 grid grid-cols-2 border-y border-line lg:grid-cols-5">
        {kpi.map(([k, v], i) => (
          <div key={k} className={`px-1 py-7 sm:px-6 ${i > 0 ? "lg:border-l lg:border-line" : ""} ${i % 2 ? "border-l border-line" : ""}`}>
            <div className="label !mb-3">{k}</div>
            <div className="display text-6xl font-extrabold leading-none sm:text-7xl">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-14 lg:grid-cols-2">
        <section>
          <h2 className="display text-3xl font-bold uppercase">Joins per day</h2>
          <div className="mt-6 flex h-44 items-end gap-2 border-b border-line">
            {s.timeline.length === 0 && <p className="self-center text-sm text-dim">No joins yet.</p>}
            {s.timeline.map((t) => (
              <div key={t.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${t.date}: ${t.joins}`}>
                <span className="mono text-[10px] text-dim">{t.joins}</span>
                <div className="w-full bg-signal" style={{ height: `${(t.joins / max) * 100}%`, minHeight: 3 }} />
              </div>
            ))}
          </div>
          <div className="mono mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-faint">
            <span>{s.timeline[0]?.date}</span>
            <span>{s.timeline.at(-1)?.date}</span>
          </div>
        </section>

        <section>
          <h2 className="display text-3xl font-bold uppercase">Where they came from</h2>
          <ul className="mt-6 border-t border-line text-sm">
            {s.sources.length === 0 && <li className="border-b border-line py-3 text-dim">No data yet.</li>}
            {s.sources.map((x) => (
              <li key={x.ref} className="flex justify-between border-b border-line py-3">
                <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">{x.ref}</span>
                <span className="mono text-xs">{x.joins}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2">
          <h2 className="display text-3xl font-bold uppercase">Experiences</h2>
          <ul className="mt-6 border-t border-line">
            {s.perExperience.map((e, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 border-b border-line py-4 text-sm">
                <span className="display truncate text-xl font-bold uppercase">{e.title}</span>
                <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">
                  stage {Math.min(e.stage, e.stages)}/{e.stages}
                </span>
                <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">{e.players} players</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <a href="/api/proof?format=csv" className="btn mt-12">
        <Download size={15} /> Download CSV
      </a>
      <p className="mono mt-3 text-[10px] uppercase tracking-[0.14em] text-faint">Generated {new Date(s.generatedAt).toUTCString()}</p>
    </div>
  );
}
