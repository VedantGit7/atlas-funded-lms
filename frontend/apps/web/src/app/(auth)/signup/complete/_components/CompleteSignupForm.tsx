"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { valuesToFormData } from "@/lib/forms/values-to-form-data";
import {
  completeSignupAction,
  type CompleteSignupActionState,
} from "../_actions/complete-signup-action";

const fieldLabelClass = "mb-2 block text-[13px] font-semibold text-[var(--fba-tx2)]";

const fieldInputClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[15px] text-[var(--fba-tx)] outline-none transition-colors placeholder:text-[var(--fba-tx3)] focus:border-[var(--fba-ind)] aria-[invalid=true]:border-[var(--fba-red)]";

const primaryButtonClass =
  "w-full rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white shadow-[0_10px_40px_rgba(0,0,0,0.07)] transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const inlineLinkClass =
  "text-[13px] font-semibold text-[var(--fba-ind-tx)] transition-colors hover:underline";

const MIN_LENGTH = 10;

const initialState: CompleteSignupActionState = { ok: false, message: "", requestId: "" };

/**
 * The page a sign-up's emailed link opens (security review 5.3, finding 1):
 * the address is proven, so the password is chosen here and the account is
 * created and signed in.
 */
export function CompleteSignupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(completeSignupAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  // A full navigation, as after sign-in, so the destination loads with the
  // new session cookie.
  useEffect(() => {
    if (state.ok && state.destination) {
      window.location.href = state.destination;
    }
  }, [state.ok, state.destination]);

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="mb-2 text-[28px] font-extrabold leading-[1.2] text-[var(--fba-tx)]">
          This link is incomplete
        </h2>
        <p className="mb-6 text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          Open the link from your email again, or sign up to get a new one.
        </p>
        <Link href="/signup" className={inlineLinkClass}>
          Sign up
        </Link>
      </div>
    );
  }

  if (state.ok && state.destination) {
    return (
      <p role="status" className="text-center text-[15px] text-[var(--fba-tx2)]">
        Your account is ready. Taking you in…
      </p>
    );
  }

  const message = localError || state.message;

  return (
    <div>
      <div className="mb-8">
        <h2
          id="complete-signup-title"
          className="mb-2 text-[32px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]"
        >
          Choose your password
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
          Your email is confirmed. Pick a strong password you don&apos;t use anywhere else to finish
          creating your account.
        </p>
      </div>

      <form
        aria-labelledby="complete-signup-title"
        className="space-y-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < MIN_LENGTH) {
            setLocalError(`Password must be at least ${String(MIN_LENGTH)} characters.`);
            return;
          }
          if (password !== confirmPassword) {
            setLocalError("Passwords do not match.");
            return;
          }
          setLocalError("");
          formAction(valuesToFormData({ token, password }));
        }}
      >
        <div>
          <label htmlFor="password" className={fieldLabelClass}>
            Password
          </label>
          <input
            id="password"
            name="password"
            required
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={`At least ${String(MIN_LENGTH)} characters`}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (localError) setLocalError("");
            }}
            className={fieldInputClass}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={fieldLabelClass}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            required
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (localError) setLocalError("");
            }}
            aria-invalid={localError === "Passwords do not match." ? true : undefined}
            className={fieldInputClass}
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[var(--fba-tx2)]">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => {
              setShowPassword(event.target.checked);
            }}
          />
          Show password
        </label>

        {message ? (
          <p role="alert" className="text-[13px] text-[var(--fba-red-tx)]">
            {message}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--fba-tx2)]">
        Already have an account?{" "}
        <Link href="/login" className={inlineLinkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
