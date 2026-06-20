"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "../../../lib/client-api";
import { diagnosticApiClient } from "../../../modules/diagnostics/diagnostic.api-client";

type DiagnosticIdentityGateProps = {
  anonymousId: string;
  open: boolean;
  onClose: () => void;
};

type PublicAuthResponse = {
  data: {
    status: string;
    redirectTo?: string | null;
  };
};

export function DiagnosticIdentityGate({
  anonymousId,
  open,
  onClose,
}: DiagnosticIdentityGateProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      if (mode === "signup") {
        await clientApi.post<PublicAuthResponse>(
          "/api/v1/public/auth/signup",
          { email, password, displayName },
          "diagnostic-signup",
        );
      } else {
        await clientApi.post<PublicAuthResponse>(
          "/api/v1/public/auth/login",
          { email, password },
          "diagnostic-login",
        );
      }

      const mergeResult = await diagnosticApiClient.mergePublicDiagnostic(anonymousId);
      router.push(mergeResult.data.resultPath);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to create or sign in to your account.",
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="identity-gate-title"
      className="w-full max-w-md rounded border p-0 backdrop:bg-black/40"
      onClose={onClose}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="identity-gate-title" className="text-lg font-semibold">
              Save your diagnostic results
            </h2>
            <p className="mt-1 text-sm opacity-80">
              Create a free account or sign in to unlock your full scorecard and learning handoff.
            </p>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded border px-3 py-1 ${mode === "signup" ? "font-semibold" : ""}`}
            onClick={() => {
              setMode("signup");
            }}
          >
            Create account
          </button>
          <button
            type="button"
            className={`rounded border px-3 py-1 ${mode === "login" ? "font-semibold" : ""}`}
            onClick={() => {
              setMode("login");
            }}
          >
            Sign in
          </button>
        </div>

        {mode === "signup" ? (
          <label className="block text-sm">
            Display name
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
              required
            />
          </label>
        ) : null}

        <label className="block text-sm">
          Email
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded border px-3 py-2"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
          />
        </label>

        <label className="block text-sm">
          Password
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="mt-1 w-full rounded border px-3 py-2"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
          />
        </label>

        {message ? (
          <p role="alert" className="text-sm text-red-700">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded border px-4 py-2 font-medium"
          >
            {status === "loading" ? "Saving…" : "Continue"}
          </button>
          <Link
            href={`/diagnostic/result?anonId=${anonymousId}`}
            className="rounded border px-4 py-2"
          >
            View scorecard only
          </Link>
        </div>
      </form>
    </dialog>
  );
}
