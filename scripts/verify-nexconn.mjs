// One-command check that your Nexconn keys + data center actually work.
// Usage: npm run verify:nexconn   (reads .env.local; never prints your secret)
import { createHash, randomBytes } from "node:crypto";

const key = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
const secret = process.env.NEXCONN_APP_SECRET;
const host = process.env.NEXCONN_API_HOST || "api.sg-light-api.com";
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

if (!key || !secret) {
  bad("NEXT_PUBLIC_NEXCONN_APP_KEY and NEXCONN_APP_SECRET must be set in .env.local");
  process.exit(1);
}
console.log(`\nJOLTIDE × Nexconn check  (app key ${key.slice(0, 4)}…, host ${host})\n`);

async function call(path, body) {
  const nonce = randomBytes(8).toString("hex").slice(0, 16);
  const ts = String(Date.now());
  const signature = createHash("sha1").update(secret + nonce + ts).digest("hex");
  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: { "App-Key": key, Nonce: nonce, Timestamp: ts, Signature: signature, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || (json.code !== undefined && json.code !== 0 && json.code !== 200)) throw new Error(`${path} → HTTP ${res.status} ${text.slice(0, 160)}`);
  return json;
}

const id = Date.now().toString(36);
let failed = false;
async function step(name, fn) {
  try { await fn(); ok(name); } catch (e) { failed = true; bad(`${name}: ${e.message}`); }
}

await step("issue access token (user)", async () => {
  const r = await call("/v4/auth/access-token/issue", { userId: `verify${id}`, name: "Verify" });
  if (!(r.result?.accessToken ?? r.token)) throw new Error("no access token returned");
});
await step("issue access token (system user)", () => call("/v4/auth/access-token/issue", { userId: "joltide", name: "JOLTIDE" }));
await step("create group channel", () => call("/v4/group-channel/create", { channelId: `jtgverify${id}`, name: "verify", owner: "joltide", userIds: [`verify${id}`] }));
await step("send group message (JT:Event custom type)", () => call("/v4/group-channel/message/send", { fromUserId: "joltide", toChannelIds: [`jtgverify${id}`], messageType: "JT:Event", content: JSON.stringify({ kind: "progress" }), isEchoToSender: 0 }));
await step("create open channel", () => call("/v4/open-channel/create", { channelId: `jtoverify${id}`, destroyType: 1, ttlMinutes: 60 }));
await step("send open channel message", () => call("/v4/open-channel/message/send", { fromUserId: "joltide", toChannelIds: [`jtoverify${id}`], messageType: "RC:TxtMsg", content: JSON.stringify({ content: "hello" }) }));

console.log(failed ? "\nSome checks failed. Fix those first (wrong data center host is the usual cause).\n" : "\nAll good. Chat will work end to end.\n");
process.exit(failed ? 1 : 0);
