"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type Identity, useIdentity } from "@/lib/identity";

interface Ctx {
  identity: Identity | null;
  ready: boolean;
  /** Resolves with an identity, prompting for a display name first if needed. */
  ensure: () => Promise<Identity>;
  rename: () => void;
}
const IdentityCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(IdentityCtx);
  if (!c) throw new Error("IdentityProvider missing");
  return c;
};

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const { identity, ready, save } = useIdentity();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const resolver = useRef<((i: Identity) => void) | null>(null);
  const identityRef = useRef<Identity | null>(null);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  const ensure = useCallback(
    () =>
      new Promise<Identity>((resolve) => {
        if (identityRef.current) return resolve(identityRef.current);
        resolver.current = resolve;
        setErr(null);
        setName("");
        setOpen(true);
      }),
    [],
  );
  const rename = useCallback(() => {
    setName(identityRef.current?.name ?? "");
    resolver.current = null;
    setOpen(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    try {
      const next = await save(name);
      identityRef.current = next;
      setOpen(false);
      resolver.current?.(next);
      resolver.current = null;
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };

  return (
    <IdentityCtx.Provider value={{ identity, ready, ensure, rename }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-panel p-7 shadow-2xl">
            <form onSubmit={submit}>
              <span className="label">Step into the room</span>
              <Dialog.Title className="display text-4xl font-semibold leading-[0.95]">What should we call you?</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-dim">
                No account, no password. This is the name other players see in chat.
              </Dialog.Description>
              <input className="input mt-6" autoFocus maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nova" aria-label="Display name" />
              {err && (
                <p role="alert" className="mt-3 text-xs text-bad">
                  {err}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="btn btn-sm">
                    Cancel
                  </button>
                </Dialog.Close>
                <button className="btn btn-primary btn-sm" disabled={!name.trim()}>
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </IdentityCtx.Provider>
  );
}
