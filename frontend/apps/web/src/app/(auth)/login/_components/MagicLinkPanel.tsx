"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

const fieldInputClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[15px] text-[var(--fba-tx)] outline-none focus:border-[var(--fba-ind)]";

const secondaryButtonClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[14px] font-semibold text-[var(--fba-tx)] transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)] disabled:opacity-60";

export function MagicLinkPanel() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendLink(event: React.SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const emailRedirectTo = `${window.location.origin}/auth/confirm`;
      await clientApi.post(
        "/api/v1/public/auth/magic-link",
        { email, emailRedirectTo },
        "magic-link",
      );
      setMessage("If an account exists for this email, a sign-in link has been sent.");
      setOpen(false);
    } catch (error) {
      setMessage(
        error instanceof ClientApiError
          ? error.message
          : "Unable to send sign-in link. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setOpen(true);
          }}
        >
          Email me a sign-in link
        </button>
        {message ? <p className="mt-3 text-[13px] text-[var(--fba-tx2)]">{message}</p> : null}
      </div>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={(e) => void sendLink(e)}>
      <p className="text-[13px] text-[var(--fba-tx2)]">
        We&apos;ll email you a secure link to sign in without a password.
      </p>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="name@company.com"
        className={fieldInputClass}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-[10px] bg-[var(--fba-ind)] px-4 py-3 text-[14px] font-bold text-white hover:bg-[var(--fba-ind-d)] disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Sending..." : "Send link"}
        </button>
      </div>
      {message ? <p className="text-[13px] text-[var(--fba-tx2)]">{message}</p> : null}
    </form>
  );
}
