"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { performAtlasLogout } from "../../../lib/auth/perform-logout";

export function LogoutConfirmButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  async function handleLogout() {
    setBusy(true);
    setMessage(null);
    try {
      const destination = await performAtlasLogout();
      router.push(destination);
      router.refresh();
    } catch {
      setMessage("Unable to sign out. Try again.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <section className="rounded border p-4" aria-labelledby="logout-heading">
      <h2 id="logout-heading" className="text-lg font-semibold">
        Sign out
      </h2>
      <p className="text-sm opacity-80">End your session on this device.</p>
      <button
        type="button"
        className="mt-3 rounded-md border px-4 py-2 text-sm font-medium"
        onClick={() => {
          setOpen(true);
          queueMicrotask(() => confirmRef.current?.focus());
        }}
      >
        Sign out
      </button>
      {open ? (
        <div
          className="mt-4 space-y-3 rounded border p-4"
          role="dialog"
          aria-labelledby="logout-confirm-title"
        >
          <h3 id="logout-confirm-title" className="font-medium">
            Confirm sign out
          </h3>
          <p className="text-sm">You will need to sign in again to access learner pages.</p>
          <div className="flex gap-2">
            <button
              ref={confirmRef}
              type="button"
              className="rounded-md border px-4 py-2 text-sm font-medium"
              disabled={busy}
              onClick={() => void handleLogout()}
            >
              Confirm sign out
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm"
              disabled={busy}
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
