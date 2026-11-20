"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

/** Early-access list for paid/team plans. Emails are private; only a count is ever shown (on /proof). */
export default function Waitlist({ label = "Join the waitlist", plan = "pro" }: { label?: string; plan?: "pro" | "studio" }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | string>("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const r = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plan, note: note || undefined }) });
    const j = await r.json();
    setState(r.ok ? "done" : j.error ?? "Something went wrong");
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setState("idle");
      }}
    >
      <Dialog.Trigger asChild>
        <button className="text-signal underline-offset-4 hover:underline">{label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 border border-line-strong bg-panel p-7">
          {state === "done" ? (
            <div>
              <span className="label">You&apos;re on the list</span>
              <Dialog.Title className="display text-4xl font-bold uppercase leading-[0.92]">Thanks.</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-dim">We&apos;ll email you once when paid plans open.</Dialog.Description>
              <Dialog.Close asChild>
                <button className="btn btn-primary mt-6">Close</button>
              </Dialog.Close>
            </div>
          ) : (
            <form onSubmit={submit}>
              <span className="label">Paid and team plans</span>
              <Dialog.Title className="display text-4xl font-bold uppercase leading-[0.92]">Get early access</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-dim">Paid plans aren&apos;t available yet. Leave your email and we&apos;ll write once when they open. It&apos;s never shown publicly.</Dialog.Description>
              <input className="input mt-5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" />
              <input className="input mt-3" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What would you run? (optional)" aria-label="What would you run" />
              {state !== "idle" && state !== "sending" && (
                <p role="alert" className="mt-3 text-xs text-bad">
                  {state}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="btn btn-sm">
                    Cancel
                  </button>
                </Dialog.Close>
                <button className="btn btn-primary btn-sm" disabled={state === "sending" || !email}>
                  {state === "sending" ? "Sending…" : "Notify me"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
