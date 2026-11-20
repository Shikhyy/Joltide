import { describe, expect, it } from "vitest";
import { isPlayer, keyMatches, mintIdentity, requirePlayer, signId } from "@/lib/player";

const req = (key?: string) => new Request("http://x/api", { headers: key ? { "x-player-key": key } : {} });

describe("player identity keys", () => {
  it("mints a valid id and a key that verifies for that id only", () => {
    const a = mintIdentity();
    const b = mintIdentity();
    expect(a.id).toMatch(/^[A-Za-z0-9]{3,40}$/);
    expect(a.id).not.toBe(b.id);
    expect(keyMatches(a.id, a.key)).toBe(true);
    expect(keyMatches(a.id, b.key)).toBe(false); // someone else's key can't act as you
    expect(keyMatches(b.id, a.key)).toBe(false);
  });

  it("rejects missing, empty, truncated and tampered keys", () => {
    const a = mintIdentity();
    expect(keyMatches(a.id, undefined)).toBe(false);
    expect(keyMatches(a.id, "")).toBe(false);
    expect(keyMatches(a.id, a.key.slice(0, -2))).toBe(false);
    expect(keyMatches(a.id, a.key + "x")).toBe(false);
    expect(keyMatches("uforgedid", signId("uotherid"))).toBe(false);
  });

  it("requirePlayer accepts the owner and throws 401 for everyone else", () => {
    const a = mintIdentity();
    expect(() => requirePlayer(req(a.key), a.id)).not.toThrow();
    expect(() => requirePlayer(req(), a.id)).toThrow(/invalid_player/);
    expect(() => requirePlayer(req(mintIdentity().key), a.id)).toThrow(/invalid_player/);
    expect(isPlayer(req(a.key), a.id)).toBe(true);
    expect(isPlayer(req(a.key), mintIdentity().id)).toBe(false);
  });
});
