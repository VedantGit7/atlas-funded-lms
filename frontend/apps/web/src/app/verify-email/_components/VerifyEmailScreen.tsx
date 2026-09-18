"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TenantBrandMark } from "@/components/patterns/TenantBrandMark";
import { Plus_Jakarta_Sans } from "next/font/google";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";
import { ResendVerificationForm } from "./ResendVerificationForm";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export type VerifyEmailStatus = "success" | "sent" | "expired" | "invalid";

type VerifyEmailScreenProps = {
  /** The tenant's own logo; an initials mark is shown when they have none. */
  logoUrl?: string | null;
  /** Tenant public name — this screen used to hardcode "FundedBeyond Academy". */
  tenantName?: string | null;
  /**
   * Support contact: the tenant's own address, or the platform address when
   * they have not set one. Null hides the contact line entirely — better than
   * pointing every academy's learners at another tenant's inbox.
   */
  supportEmail?: string | null;
  initialEmail: string;
  status: VerifyEmailStatus;
  /** Sanitized destination for the success auto-redirect. */
  next: string;
};

const SUCCESS_REDIRECT_MS = 3200;
const SUCCESS_REDIRECT_GUARD_KEY = "fba-verify-success-redirected";

type Tone = "brand" | "warn" | "success";

const COPY: Record<
  VerifyEmailStatus,
  { eyebrow: string; title: string; lead: string; tone: Tone }
> = {
  success: {
    eyebrow: "Verified",
    title: "You're all set",
    lead: "Your account is verified. Taking you to your dashboard…",
    tone: "success",
  },
  sent: {
    eyebrow: "Verification sent",
    title: "Check your inbox",
    lead: "We sent a secure verification link to activate your account. Click it to finish signing up — the link is valid for 24 hours.",
    tone: "brand",
  },
  expired: {
    eyebrow: "Link expired",
    title: "This link has expired",
    lead: "Your verification link has expired or was already used. Request a fresh one below and we'll email it right over.",
    tone: "warn",
  },
  invalid: {
    eyebrow: "Link unreadable",
    title: "We couldn't read that link",
    lead: "That verification link looks incomplete. Request a new one below to continue.",
    tone: "warn",
  },
};

// Deterministic particle field (no Math.random) to keep SSR/CSR markup stable.
const PARTICLES = [
  {
    left: "16%",
    top: "24%",
    size: 6,
    dx: "10px",
    dy: "-44px",
    dur: "6.5s",
    delay: "0s",
    gold: true,
  },
  {
    left: "78%",
    top: "30%",
    size: 5,
    dx: "-12px",
    dy: "-38px",
    dur: "7.5s",
    delay: "0.8s",
    gold: false,
  },
  {
    left: "30%",
    top: "74%",
    size: 4,
    dx: "8px",
    dy: "-50px",
    dur: "8s",
    delay: "1.6s",
    gold: true,
  },
  {
    left: "68%",
    top: "70%",
    size: 6,
    dx: "-6px",
    dy: "-46px",
    dur: "6.8s",
    delay: "0.4s",
    gold: false,
  },
  {
    left: "50%",
    top: "18%",
    size: 4,
    dx: "0px",
    dy: "-40px",
    dur: "7.2s",
    delay: "1.1s",
    gold: true,
  },
  {
    left: "88%",
    top: "54%",
    size: 5,
    dx: "-14px",
    dy: "-34px",
    dur: "8.4s",
    delay: "2s",
    gold: false,
  },
] as const;

const SPARKLES = [
  { left: "6%", top: "8%", size: 22, delay: "0.2s" },
  { left: "86%", top: "20%", size: 16, delay: "1s" },
  { left: "78%", top: "78%", size: 18, delay: "1.6s" },
  { left: "12%", top: "70%", size: 14, delay: "0.7s" },
] as const;

function SparkGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--fba-gld)" aria-hidden>
      <path d="M12 0c.6 5.2 3.8 8.4 9 9-5.2.6-8.4 3.8-9 9-.6-5.2-3.8-8.4-9-9 5.2-.6 8.4-3.8 9-9z" />
    </svg>
  );
}

function EnvelopeGlyph({ accent, warn }: { accent: string; warn: boolean }) {
  return (
    <span className="relative inline-flex">
      <svg
        width="42"
        height="42"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accent}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect
          x="2.5"
          y="5"
          width="19"
          height="14"
          rx="2.5"
          fill={`color-mix(in srgb, ${accent} 12%, transparent)`}
        />
        <path d="m3 7 9 6 9-6" />
      </svg>
      <span
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
        style={{
          backgroundColor: warn ? "var(--fba-gld)" : "var(--fba-ind)",
          boxShadow: "0 0 0 2px var(--fba-surf)",
        }}
      >
        {warn ? "!" : ""}
      </span>
    </span>
  );
}

function CheckGlyph({ accent }: { accent: string }) {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 24 24"
      fill="none"
      stroke={accent}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="fba-ve-pop"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ClockGlyph({ accent }: { accent: string }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke={accent}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" fill={`color-mix(in srgb, ${accent} 12%, transparent)`} />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HeroGlyph({ status, accent }: { status: VerifyEmailStatus; accent: string }) {
  if (status === "success") {
    return <CheckGlyph accent={accent} />;
  }
  if (status === "expired") {
    return <ClockGlyph accent={accent} />;
  }
  return <EnvelopeGlyph accent={accent} warn={status === "invalid"} />;
}

function VerifyHero({ status }: { status: VerifyEmailStatus }) {
  const tone = COPY[status].tone;
  const isSuccess = tone === "success";
  const accent =
    tone === "warn" ? "var(--fba-gld)" : tone === "success" ? "var(--fba-grn)" : "var(--fba-ind)";
  // The glow/orbit read better in indigo even for the green success check.
  const ring = isSuccess ? "var(--fba-ind)" : accent;

  return (
    <div className="relative mx-auto mb-8 flex h-56 w-56 items-center justify-center sm:h-60 sm:w-60">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="fba-ve-glow absolute inset-3 rounded-full"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${ring} 38%, transparent), transparent 66%)`,
          filter: "blur(14px)",
        }}
      />

      {/* Outer orbital ring + riding particle */}
      <div
        aria-hidden
        className="absolute inset-1 rounded-full"
        style={{ border: `1px solid color-mix(in srgb, ${ring} 28%, transparent)` }}
      />
      <div aria-hidden className="fba-ve-orbit absolute inset-1">
        <span
          className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: "var(--fba-gld)", boxShadow: "0 0 10px var(--fba-gld)" }}
        />
      </div>

      {/* Inner dashed ring (counter-rotating) */}
      <div
        aria-hidden
        className="absolute inset-7 rounded-full"
        style={{ border: `1px dashed color-mix(in srgb, ${ring} 22%, transparent)` }}
      />
      <div aria-hidden className="fba-ve-orbit-rev absolute inset-7">
        <span
          className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: ring }}
        />
      </div>

      {/* Drifting particles (sent/error) or celebratory sparkles (success) */}
      {isSuccess
        ? SPARKLES.map((s, i) => (
            <span
              key={i}
              aria-hidden
              className="fba-ve-sparkle absolute"
              style={{ left: s.left, top: s.top, ["--ve-delay" as string]: s.delay }}
            >
              <SparkGlyph size={s.size} />
            </span>
          ))
        : PARTICLES.map((p, i) => (
            <span
              key={i}
              aria-hidden
              className="fba-ve-particle absolute rounded-full"
              style={
                {
                  left: p.left,
                  top: p.top,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: p.gold ? "var(--fba-gld)" : ring,
                  opacity: 0.7,
                  "--ve-dx": p.dx,
                  "--ve-dy": p.dy,
                  "--ve-dur": p.dur,
                  "--ve-delay": p.delay,
                } as React.CSSProperties
              }
            />
          ))}

      {/* Floating glass medallion */}
      <div
        className="fba-ve-float fba-ve-glass relative z-10 flex h-24 w-24 items-center justify-center rounded-[28px]"
        style={{ boxShadow: `0 12px 40px color-mix(in srgb, ${accent} 28%, transparent)` }}
      >
        <HeroGlyph status={status} accent={accent} />
      </div>
    </div>
  );
}

function SecuredBadge() {
  return (
    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-3.5 py-1.5">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--fba-grn)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span className="text-[12px] font-semibold text-[var(--fba-tx2)]">
        Secured with SSL verification
      </span>
    </div>
  );
}

export function VerifyEmailScreen({
  initialEmail,
  status,
  next,
  logoUrl = null,
  tenantName = null,
  supportEmail = null,
}: VerifyEmailScreenProps) {
  const { darkMode, toggleDark } = useFbaTheme();

  // Neutral fallbacks: this screen serves every tenant, so a branded default
  // showed tenant #1 to any academy that had not set a publicName.
  const fullName = tenantName?.trim() ?? "Your academy";
  const brandName = fullName.replace(/\s*Academy\s*$/i, "") || fullName;
  const hasAcademySuffix = /academy/i.test(fullName);

  const copy = COPY[status];
  const isSuccess = status === "success";
  const isWarn = copy.tone === "warn";
  const redirectTarget = next.startsWith("/") ? next : "/";
  const hasKnownEmail = status === "sent" && initialEmail.trim().length > 0;

  // Success: auto-redirect to the resolved destination after a brief beat.
  // Guarded with a one-shot sessionStorage flag so that if the destination ever
  // sends the browser back to this success screen, we don't auto-redirect again
  // and spin up an infinite navigation loop — the manual button still works.
  useEffect(() => {
    if (!isSuccess) {
      return;
    }
    try {
      if (sessionStorage.getItem(SUCCESS_REDIRECT_GUARD_KEY)) {
        return;
      }
    } catch {
      // Storage unavailable (private mode) — fall through and redirect once.
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SUCCESS_REDIRECT_GUARD_KEY, "1");
      } catch {
        // Ignore; the redirect below is the important part.
      }
      window.location.assign(redirectTarget);
    }, SUCCESS_REDIRECT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isSuccess, redirectTarget]);

  return (
    <div
      className={`fba-scope ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""} relative flex min-h-screen flex-col overflow-hidden bg-[var(--fba-bg)] text-[var(--fba-tx)]`}
    >
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-[-10%] h-[460px] w-[460px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--fba-ind) 16%, transparent), transparent 70%)",
          filter: "blur(120px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-[-10%] h-[460px] w-[460px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--fba-gld) 12%, transparent), transparent 70%)",
          filter: "blur(120px)",
        }}
      />

      {/* Header — sticky + opaque so hero glows never intercept clicks */}
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-[var(--fba-bdr)] bg-[var(--fba-nav-bg)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            aria-label={`${fullName} home`}
            className="flex items-center gap-2.5 no-underline transition-opacity hover:opacity-90"
          >
            <TenantBrandMark
              logoUrl={logoUrl}
              name={fullName}
              size={32}
              className="h-8 w-8 shrink-0 rounded-full"
            />
            <span className="text-[14px] font-extrabold text-[var(--fba-tx)]">
              {brandName}
              {hasAcademySuffix ? (
                <span className="font-medium text-[var(--fba-tx3)]"> Academy</span>
              ) : null}
            </span>
          </Link>
          <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-grow items-center justify-center px-5 py-10">
        <div className="fba-ve-rise w-full max-w-[480px] text-center">
          <VerifyHero status={status} />

          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fba-ind)]">
            {copy.eyebrow}
          </p>
          <h1 className="mb-3 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--fba-tx)] sm:text-[34px]">
            {copy.title}
          </h1>
          <p className="mx-auto mb-5 max-w-[400px] text-[15px] leading-[1.65] text-[var(--fba-tx2)]">
            {copy.lead}
          </p>

          {hasKnownEmail ? (
            <div className="mx-auto mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-4 py-2">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--fba-ind)"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span className="truncate text-[13px] font-semibold text-[var(--fba-tx)]">
                {initialEmail}
              </span>
            </div>
          ) : (
            <div className="mb-8" />
          )}

          {isSuccess ? (
            /* Success: auto-redirect card with progress line + immediate action. */
            <div className="fba-ve-glass relative overflow-hidden rounded-2xl p-7 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
              <a
                href={redirectTarget}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white no-underline transition-colors hover:bg-[var(--fba-ind-d)] active:scale-[0.98]"
                style={{
                  boxShadow: "0 10px 40px color-mix(in srgb, var(--fba-ind) 35%, transparent)",
                }}
              >
                Go to dashboard now
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>

              {/* Thin auto-redirect progress line. */}
              <div className="absolute bottom-0 left-0 h-1 w-full bg-[var(--fba-bg2)]">
                <div
                  className="fba-ve-progress h-full"
                  style={{
                    backgroundColor: "var(--fba-gld)",
                    ["--ve-progress-dur" as string]: `${SUCCESS_REDIRECT_MS}ms`,
                  }}
                />
              </div>
            </div>
          ) : (
            <ResendVerificationForm initialEmail={initialEmail} status={status} isWarn={isWarn} />
          )}

          <div className="flex flex-col items-center">
            {isWarn ? (
              <div className="mt-7 flex w-full max-w-[360px] items-center justify-center gap-2 border-t border-[var(--fba-bdr)] pt-6 text-[var(--fba-tx3)]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[12px] leading-[1.5]">
                  Verification links expire after 24 hours for your security.
                </span>
              </div>
            ) : (
              <>
                <SecuredBadge />
                {!isSuccess ? (
                  <p className="mt-6 max-w-[360px] text-[13px] leading-[1.6] text-[var(--fba-tx3)]">
                    Didn&apos;t receive anything? Check your spam folder
                    {supportEmail ? (
                      <>
                        {" or "}
                        <a
                          href={`mailto:${supportEmail}`}
                          className="font-semibold text-[var(--fba-ind)] underline decoration-[var(--fba-bdr2)] underline-offset-2 transition-colors hover:decoration-[var(--fba-ind)]"
                        >
                          contact support
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--fba-bdr)] py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-3 px-5 text-center sm:px-8">
          <span className="text-[13px] font-extrabold text-[var(--fba-ind)]">{fullName}</span>
          <nav className="flex flex-wrap justify-center gap-5">
            <Link
              href="/terms"
              className="text-[12px] text-[var(--fba-tx3)] transition-colors hover:text-[var(--fba-ind)]"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-[12px] text-[var(--fba-tx3)] transition-colors hover:text-[var(--fba-ind)]"
            >
              Privacy Policy
            </Link>
          </nav>
          <p className="text-[12px] text-[var(--fba-tx3)]">
            Educational trading readiness academy · Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
