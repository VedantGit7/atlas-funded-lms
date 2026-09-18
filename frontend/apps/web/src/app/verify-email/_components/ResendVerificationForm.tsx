"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { resendVerificationAction, type ResendActionState } from "../_actions/resend-action";
import type { VerifyEmailStatus } from "./VerifyEmailScreen";

const RESEND_COOLDOWN_SECONDS = 60;

const initialState: ResendActionState = { ok: false, message: "" };

type ResendVerificationFormProps = {
  initialEmail: string;
  status: VerifyEmailStatus;
  isWarn: boolean;
};

export function ResendVerificationForm({
  initialEmail,
  status,
  isWarn,
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(status === "sent" ? RESEND_COOLDOWN_SECONDS : 0);
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  const hasKnownEmail = status === "sent" && initialEmail.trim().length > 0;
  const showEmailInput = !hasKnownEmail;
  const disabled = pending || cooldown > 0 || (showEmailInput && email.trim().length === 0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCooldown((current) => current - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  useEffect(() => {
    if (state.ok) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [state]);

  return (
    <div className="fba-ve-glass relative overflow-hidden rounded-2xl p-6 text-left shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:p-7">
      {isWarn ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in srgb, var(--fba-gld) 18%, transparent), transparent 60%)",
          }}
        />
      ) : null}
      <form action={formAction} className="relative space-y-4" noValidate>
        {showEmailInput ? (
          <div>
            <label
              htmlFor="resend-email"
              className="mb-2 block text-[13px] font-semibold text-[var(--fba-tx2)]"
            >
              Email address
            </label>
            <input
              id="resend-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              className="w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3 text-[15px] text-[var(--fba-tx)] outline-none transition-colors placeholder:text-[var(--fba-tx3)] focus:border-[var(--fba-ind)]"
            />
          </div>
        ) : (
          <input type="hidden" name="email" value={initialEmail} />
        )}

        {state.message ? (
          state.ok ? (
            <div
              role="status"
              style={{ backgroundColor: "color-mix(in srgb, var(--fba-grn) 12%, transparent)" }}
              className="fba-ve-pop flex items-center justify-center gap-2 rounded-[10px] border border-[var(--fba-grn)] px-4 py-2.5 text-center text-[13px] font-semibold text-[var(--fba-grn)]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {state.message}
            </div>
          ) : (
            <p role="alert" className="text-[13px] text-[var(--fba-red-tx)]">
              {state.message}
            </p>
          )
        ) : null}

        <button
          type="submit"
          disabled={disabled}
          style={{ boxShadow: "0 10px 40px color-mix(in srgb, var(--fba-ind) 35%, transparent)" }}
          className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${pending ? "fba-ve-shimmer" : ""}`}
        >
          {!pending && cooldown <= 0 ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          ) : null}
          {pending
            ? "Sending…"
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend verification email"}
        </button>

        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-[var(--fba-ind-tx)] transition-opacity hover:opacity-80"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
