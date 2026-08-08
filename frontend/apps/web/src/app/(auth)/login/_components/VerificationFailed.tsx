"use client";

import Link from "next/link";

type VerificationFailedProps = {
  /** Server-provided reason; falls back to a generic message. */
  message?: string;
  onRetry: () => void;
};

const primaryButtonClass =
  "w-full rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white shadow-[0_10px_40px_rgba(0,0,0,0.07)] transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98]";

function ErrorIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-transform group-hover:-translate-x-1"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Shown when an MFA code is rejected (invalid / expired). Mirrors the
 * VerificationSuccess layout but in the error palette derived from `--fba-red`,
 * so it stays theme-correct. Actions are limited to ones that actually exist:
 * retry (returns to the code entry) and back to sign in — TOTP has no
 * resend/backup-code flow in this system.
 */
export function VerificationFailed({ message, onRetry }: VerificationFailedProps) {
  const red = "var(--fba-red)";
  const redTint = "color-mix(in srgb, var(--fba-red) 13%, var(--fba-surf))";
  const redBorder = "color-mix(in srgb, var(--fba-red) 25%, transparent)";
  const redGlow = "color-mix(in srgb, var(--fba-red) 30%, transparent)";

  return (
    <div role="alert" aria-live="assertive" className="fba-loader-reveal flex flex-col items-center text-center">
      <div className="relative mb-8 flex h-[120px] w-[120px] items-center justify-center">
        <span
          aria-hidden
          className="fba-pulse-halo absolute h-[110px] w-[110px] rounded-full blur-2xl"
          style={{ backgroundColor: redGlow }}
        />
        <span
          className="fba-success-pop relative flex h-14 w-14 items-center justify-center rounded-full border-[1.5px]"
          style={{
            backgroundColor: redTint,
            borderColor: redBorder,
            color: red,
            boxShadow: `0 0 30px 8px ${redGlow}`,
          }}
        >
          <ErrorIcon />
        </span>
      </div>

      <h2 className="mb-2 text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]">
        Verification failed
      </h2>
      <p className="mb-8 max-w-[340px] text-[15px] leading-[1.6] text-[var(--fba-tx2)]">
        {message ||
          "The code you entered is invalid or has expired. Double-check your authenticator app and try again."}
      </p>

      <div className="w-full space-y-4">
        <button type="button" onClick={onRetry} className={primaryButtonClass}>
          Try again
        </button>
        <Link
          href="/login"
          className="group inline-flex w-full items-center justify-center gap-2 text-[13px] font-semibold text-[var(--fba-ind)] transition-colors hover:text-[var(--fba-ind-d)]"
        >
          <ArrowLeftIcon />
          Back to Sign In
        </Link>
      </div>

      <div className="mt-10 flex w-full items-start gap-4 rounded-[14px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-bg2)] p-5 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fba-gld-l)] text-[var(--fba-gld)]">
          <HelpIcon />
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-bold text-[var(--fba-tx)]">Lost access to your device?</h3>
          <p className="text-[13px] leading-[1.6] text-[var(--fba-tx2)]">
            If you can no longer use your authenticator app, contact our support team to recover your
            account.
          </p>
        </div>
      </div>
    </div>
  );
}
