"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signupAction, type SignupActionState } from "../_actions/signup-action";

const initialState: SignupActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export function SignupForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken") ?? searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} aria-labelledby="signup-title">
      <h2 id="signup-title" className="sr-only">
        Create account
      </h2>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Display name
          <input
            required
            type="text"
            name="displayName"
            autoComplete="name"
            minLength={2}
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          />
        </label>

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
            autoComplete="new-password"
            minLength={8}
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          />
        </label>

        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      </div>

      {state.message ? (
        <p role="alert" style={{ color: state.ok ? "#027a48" : "#b42318", marginTop: "1rem" }}>
          {state.message}
        </p>
      ) : null}

      {state.verificationRequired ? (
        <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
          After verifying your email, return here to sign in.
        </p>
      ) : null}

      <button type="submit" disabled={pending} style={{ marginTop: "1rem", width: "100%" }}>
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
