"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  completePasswordResetAction,
  requestPasswordResetAction,
  type ResetPasswordActionState,
} from "../_actions/reset-password-action";

const initialState: ResetPasswordActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export function PasswordResetForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completePasswordResetAction,
    initialState,
  );
  const [recoveryTokens, setRecoveryTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  } | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (type === "recovery" && accessToken) {
      setRecoveryTokens({
        accessToken,
        refreshToken: refreshToken ?? "",
      });
    }
  }, []);

  if (recoveryTokens) {
    return (
      <form action={completeAction} aria-labelledby="complete-reset-title">
        <h2 id="complete-reset-title">Choose a new password</h2>
        <input type="hidden" name="accessToken" value={recoveryTokens.accessToken} />
        <input type="hidden" name="refreshToken" value={recoveryTokens.refreshToken} />
        <label>
          New password
          <input
            required
            type="password"
            name="password"
            minLength={8}
            autoComplete="new-password"
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        {completeState.message ? (
          <p role="alert" style={{ marginTop: "1rem" }}>
            {completeState.message}
          </p>
        ) : null}
        <button type="submit" disabled={completePending} style={{ marginTop: "1rem" }}>
          {completePending ? "Updating..." : "Update password"}
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} aria-labelledby="request-reset-title">
      <h2 id="request-reset-title">Reset your password</h2>
      <p style={{ fontSize: "0.875rem" }}>
        Enter your email and we&apos;ll send reset instructions if an account exists.
      </p>
      <label>
        Email
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>
      {requestState.message ? (
        <p role="status" style={{ marginTop: "1rem" }}>
          {requestState.message}
        </p>
      ) : null}
      <button type="submit" disabled={requestPending} style={{ marginTop: "1rem" }}>
        {requestPending ? "Sending..." : "Send reset link"}
      </button>
      <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
