"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  return "Request failed.";
}

export function InviteMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitInvite() {
    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/members/invite",
        {
          email: email.trim().toLowerCase(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        },
        "member-invite",
      );
      setEmail("");
      setDisplayName("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? "Close invite" : "Invite member"}
      </button>

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitInvite();
          }}
        >
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              required
            />
          </label>
          <label>
            Display name (optional)
            <input
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
            />
          </label>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
          <button type="submit" disabled={busy}>
            Send invite
          </button>
        </form>
      ) : null}
    </div>
  );
}
