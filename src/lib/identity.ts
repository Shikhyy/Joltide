"use client";
import { useCallback, useEffect, useState } from "react";

export interface Identity {
  id: string;
  name: string;
  /** private proof that this browser owns the id. Minted by the server, never shown to anyone else. */
  key?: string;
}

const KEY = "joltide:identity";
const KEYS = "joltide:creatorKeys";
const KEY_HEADER = "x-player-key";

export function readIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

/** Ask the server for a fresh player id + private key. */
async function mint(name: string): Promise<Identity> {
  const r = await fetch("/api/identity", { method: "POST" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Couldn't create your player");
  const id: Identity = { id: j.id, name: name.trim().slice(0, 24) || "Player", key: j.key };
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {}
  return id;
}

/**
 * Attach the player key to every same-origin /api call, so no component has to remember to.
 * If the server stops recognising the key (for example its secret was rotated), drop it and
 * reload once so a fresh identity is minted.
 */
declare global {
  interface Window {
    __joltideFetch?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__joltideFetch) {
  window.__joltideFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let isApi = false;
    try {
      const u = new URL(url, location.origin);
      isApi = u.origin === location.origin && u.pathname.startsWith("/api/");
    } catch {}
    if (!isApi) return orig(input, init);
    const key = readIdentity()?.key;
    let next = init;
    if (key) {
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!h.has(KEY_HEADER)) h.set(KEY_HEADER, key);
      next = { ...init, headers: h };
    }
    const res = await orig(input, next);
    if (res.status === 401 && key) {
      try {
        const j = await res.clone().json();
        if (j?.error === "invalid_player" && !sessionStorage.getItem("joltide:reauth")) {
          sessionStorage.setItem("joltide:reauth", "1");
          const cur = readIdentity();
          if (cur) localStorage.setItem(KEY, JSON.stringify({ id: cur.id, name: cur.name }));
          location.reload();
        }
      } catch {}
    }
    return res;
  };
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      let cur = readIdentity();
      if (cur && !cur.key) {
        // an older identity from before keys existed: keep the name, get a proper id + key
        try {
          cur = await mint(cur.name);
        } catch {
          cur = null;
        }
      }
      setIdentity(cur);
      setReady(true);
    })();
  }, []);
  const save = useCallback(async (name: string): Promise<Identity> => {
    const clean = name.trim().slice(0, 24) || "Player";
    const cur = readIdentity();
    let next: Identity;
    if (cur?.key) {
      next = { ...cur, name: clean }; // renaming keeps the same id and key
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
    } else {
      next = await mint(clean);
    }
    setIdentity(next);
    return next;
  }, []);
  return { identity, ready, save };
}

export function getCreatorKey(expId: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(KEYS) ?? "{}") as Record<string, string>)[expId] ?? null;
  } catch {
    return null;
  }
}
export function setCreatorKey(expId: string, key: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS) ?? "{}") as Record<string, string>;
    all[expId] = key;
    localStorage.setItem(KEYS, JSON.stringify(all));
  } catch {}
}
export function myExperienceIds(): string[] {
  try {
    return Object.keys(JSON.parse(localStorage.getItem(KEYS) ?? "{}"));
  } catch {
    return [];
  }
}
