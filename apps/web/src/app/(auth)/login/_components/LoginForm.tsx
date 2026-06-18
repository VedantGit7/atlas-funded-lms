"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginActionState } from "../_actions/login-action";

const initialState: LoginActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} aria-labelledby="login-title">
      <h2 id="login-title" className="sr-only">
        Sign in
      </h2>

      <div style={{ display: "grid", gap: "0.75rem" }}>
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

        <label>
          Password
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          />
        </label>
      </div>

      {state.message ? (
        <p role="alert" style={{ color: state.ok ? "#027a48" : "#b42318", marginTop: "1rem" }}>
          {state.message}
        </p>
      ) : null}

      {state.mfaRequired ? (
        <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
          MFA verification will be required before you can access protected areas.
        </p>
      ) : null}

      <button type="submit" disabled={pending} style={{ marginTop: "1rem", width: "100%" }}>
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
        <Link href="/reset-password">Forgot password?</Link>
      </p>
      <p style={{ fontSize: "0.875rem" }}>
        Need an account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}
