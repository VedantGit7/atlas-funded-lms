"use client";

type VerificationSuccessProps = {
  /** Where the user is being redirected; used by the manual fallback link. */
  destination: string;
  title?: string;
  message?: string;
};

function CheckIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon() {
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
      className="transition-transform group-hover:translate-x-1"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * Transitional "verification successful" screen shown after a correct MFA code
 * (or a direct sign-in) while the browser redirects into the app. Rendered
 * inside the AuthShell right panel, so the brand panel, theme toggle and
 * Request ID footer are already provided. Colours are token-based (success
 * green derived from `--fba-grn`) so it adapts to light and dark themes; the
 * halo is pure CSS rather than a WebGL shader.
 */
export function VerificationSuccess({
  destination,
  title = "You're verified",
  message = "Two-factor authentication confirmed. Taking you to your dashboard…",
}: VerificationSuccessProps) {
  const green = "var(--fba-grn)";
  const greenTint = "color-mix(in srgb, var(--fba-grn) 14%, var(--fba-surf))";
  const greenBorder = "color-mix(in srgb, var(--fba-grn) 25%, transparent)";
  const greenGlow = "color-mix(in srgb, var(--fba-grn) 32%, transparent)";

  return (
    <div role="status" aria-live="polite" className="fba-loader-reveal flex flex-col items-center text-center">
      <div className="relative mb-8 flex h-[120px] w-[120px] items-center justify-center">
        <span
          aria-hidden
          className="fba-pulse-halo absolute h-[110px] w-[110px] rounded-full blur-2xl"
          style={{ backgroundColor: greenGlow }}
        />
        <span
          className="fba-success-pop relative flex h-14 w-14 items-center justify-center rounded-full border-[1.5px]"
          style={{
            backgroundColor: greenTint,
            borderColor: greenBorder,
            color: green,
            boxShadow: `0 0 30px 8px ${greenGlow}`,
          }}
        >
          <CheckIcon />
        </span>
      </div>

      <h2 className="mb-2 text-[28px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[var(--fba-tx)]">
        {title}
      </h2>
      <p className="mb-8 max-w-[320px] text-[15px] leading-[1.6] text-[var(--fba-tx2)]">{message}</p>

      <div className="mb-8 flex items-center gap-2" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="fba-loader-dot h-2 w-2 rounded-full bg-[var(--fba-tx3)]"
            style={{ animationDelay: `${index * 0.2}s` }}
          />
        ))}
      </div>

      <a
        href={destination}
        className="group inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-[14px] font-bold text-[var(--fba-ind)] transition-colors hover:border-[var(--fba-ind)] hover:text-[var(--fba-ind-d)]"
      >
        Not redirected? Continue manually
        <ArrowRightIcon />
      </a>
    </div>
  );
}
