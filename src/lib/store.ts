import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Aggregate } from "./types";

/**
 * Tiny persistence layer. One document per experience (the "aggregate").
 *  - Upstash Redis REST when UPSTASH_REDIS_REST_URL/TOKEN are set (production)
 *  - JSON file otherwise (dev; /tmp on serverless, best-effort)
 * Nexconn owns messaging; this store owns experience truth.
 */

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(URL_ && TOKEN);

async function redis<T>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = (await res.json()) as { result: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

const FILE = path.join(
  process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data"),
  "joltide-db.json",
);

type FileDb = Record<string, Aggregate>;

async function readFile(): Promise<FileDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as FileDb;
  } catch {
    return {};
  }
}

let writeChain: Promise<unknown> = Promise.resolve();
async function writeFile(db: FileDb) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db));
}

export async function getAggregate(id: string): Promise<Aggregate | null> {
  if (useRedis) {
    const raw = await redis<string | null>(["GET", `jt:exp:${id}`]);
    return raw ? (JSON.parse(raw) as Aggregate) : null;
  }
  const db = await readFile();
  return db[id] ?? null;
}

export async function saveAggregate(agg: Aggregate): Promise<void> {
  if (useRedis) {
    await redis(["SET", `jt:exp:${agg.exp.id}`, JSON.stringify(agg)]);
    await redis(["SADD", "jt:ids", agg.exp.id]);
    return;
  }
  // serialise writes so concurrent requests can't clobber each other
  writeChain = writeChain.then(async () => {
    const db = await readFile();
    db[agg.exp.id] = agg;
    await writeFile(db);
  });
  await writeChain;
}

export async function listAggregates(): Promise<Aggregate[]> {
  if (useRedis) {
    const ids = await redis<string[]>(["SMEMBERS", "jt:ids"]);
    const all = await Promise.all(ids.map((id) => getAggregate(id)));
    return all.filter((a): a is Aggregate => a !== null);
  }
  return Object.values(await readFile());
}

/** Serialise read-modify-write per experience within one server instance. */
const locks = new Map<string, Promise<unknown>>();
export async function withAggregate<T>(
  id: string,
  fn: (agg: Aggregate) => Promise<T> | T,
): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.then(async () => {
    const agg = await getAggregate(id);
    if (!agg) throw new HttpError(404, "Experience not found");
    const out = await fn(agg);
    await saveAggregate(agg);
    return out;
  });
  locks.set(
    id,
    run.catch(() => undefined),
  );
  return run;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/* ------------------------------ waitlist ------------------------------ */
/* Emails are private: stored here, never returned by any API. Only the count is public. */

export interface WaitlistEntry {
  email: string;
  plan: "pro" | "studio";
  note?: string;
  at: number;
}
const WL_FILE = path.join(path.dirname(FILE), "joltide-waitlist.json");

async function readWl(): Promise<WaitlistEntry[]> {
  try {
    return JSON.parse(await fs.readFile(WL_FILE, "utf8")) as WaitlistEntry[];
  } catch {
    return [];
  }
}

/** Returns true if the email was new. */
export async function addWaitlist(entry: WaitlistEntry): Promise<boolean> {
  const email = entry.email.toLowerCase();
  if (useRedis) {
    const added = await redis<number>(["SADD", "jt:wl:emails", email]);
    if (added) await redis(["HSET", "jt:wl:data", email, JSON.stringify({ ...entry, email })]);
    return added === 1;
  }
  const all = await readWl();
  if (all.some((e) => e.email === email)) return false;
  all.push({ ...entry, email });
  await fs.mkdir(path.dirname(WL_FILE), { recursive: true });
  await fs.writeFile(WL_FILE, JSON.stringify(all));
  return true;
}

export async function waitlistCount(): Promise<number> {
  if (useRedis) return (await redis<number>(["SCARD", "jt:wl:emails"])) ?? 0;
  return (await readWl()).length;
}
