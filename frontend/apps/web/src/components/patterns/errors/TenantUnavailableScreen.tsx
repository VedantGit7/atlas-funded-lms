"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import type { TenantUnavailableReason } from "@atlas/tenant-gate";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

type TenantUnavailableVariant = TenantUnavailableReason | "TRANSIENT";

type TenantUnavailableScreenProps = Readonly<{
  branding: PublicTenantBranding;
  reason: TenantUnavailableVariant;
  requestId: string;
  retryHref?: string;
}>;

type StatusCopy = {
  eyebrow: string;
  title: string;
  description: string;
  iconTone: "warn" | "brand" | "neutral" | "refresh";
};

const COPY: Record<TenantUnavailableVariant, StatusCopy> = {
  PROVISIONING: {
    eyebrow: "Academy setup",
    title: "Academy is being set up",
    description:
      "This academy isn't ready yet. We're finishing configuration — check back shortly, or contact your academy administrator if you need access now.",
    iconTone: "brand",
  },
  SUSPENDED: {
    eyebrow: "Access paused",
    title: "Academy temporarily unavailable",
    description:
      "Access to this academy is temporarily suspended. Contact your academy administrator to learn when it will be available again.",
    iconTone: "warn",
  },
  ARCHIVED: {
    eyebrow: "Academy closed",
    title: "Academy no longer available",
    description:
      "This academy has been archived and is no longer accepting sign-ins. Contact your academy administrator if you believe this is a mistake.",
    iconTone: "neutral",
  },
  DOMAIN_INACTIVE: {
    eyebrow: "Address inactive",
    title: "This address isn't active",
    description:
      "This web address isn't currently serving an active academy. Double-check the URL or contact your academy administrator.",
    iconTone: "neutral",
  },
  TRANSIENT: {
    eyebrow: "One moment",
    title: "Just a moment",
    description:
      "We hit a brief connection issue loading your academy. This usually clears up right away — please try again.",
    iconTone: "refresh",
  },
};

const cardClass =
  "w-full max-w-[480px] rounded-xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-8 text-center shadow-[0_4px_24px_color-mix(in_srgb,var(--fba-tx)_6%,transparent)]";

function StatusIcon({ tone }: { tone: StatusCopy["iconTone"] }) {
  const shellClass = "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full";
  const shellStyle =
    tone === "warn"
      ? { background: "var(--fba-gld-l)" }
      : tone === "brand" || tone === "refresh"
        ? { background: "var(--fba-ind-l)" }
        : { background: "var(--fba-bg2)" };

  const iconColor =
    tone === "warn"
      ? "var(--fba-gld)"
      : tone === "brand" || tone === "refresh"
        ? "var(--fba-ind)"
        : "var(--fba-tx2)";

  return (
    <div className={shellClass} style={shellStyle} aria-hidden>
      {tone === "warn" ? (
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" fill={iconColor} stroke="none" />
          <rect x="14" y="4" width="4" height="16" rx="1" fill={iconColor} stroke="none" />
        </svg>
      ) : tone === "refresh" ? (
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      ) : tone === "brand" ? (
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      )}
    </div>
  );
}

function GoBackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.assign("/");
      }}
      className="text-[14px] font-medium text-[var(--fba-tx2)] transition-colors hover:text-[var(--fba-tx)]"
    >
      Go back
    </button>
  );
}

export function TenantUnavailableScreen({
  branding,
  reason,
  requestId,
  retryHref,
}: TenantUnavailableScreenProps) {
  const { darkMode, toggleDark } = useFbaTheme();
  const copy = COPY[reason];
  const isTransient = reason === "TRANSIENT";
  const academyName = branding.publicName ?? branding.issuerName ?? "Academy";
  const retryTarget = retryHref && retryHref.length > 0 ? retryHref : "/";
  const [autoRetryArmed, setAutoRetryArmed] = useState(false);

  // Hard-navigate retry clears stale RSC/dev-compile state that soft client
  // transitions can keep replaying after a transient tenant miss.
  useEffect(() => {
    if (!isTransient || !retryTarget) {
      return;
    }

    setAutoRetryArmed(true);
    const timer = window.setTimeout(() => {
      window.location.assign(retryTarget);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isTransient, retryTarget]);

  return (
    <div
      className={`fba-scope ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""} relative flex min-h-screen flex-col overflow-hidden bg-[var(--fba-bg)] text-[var(--fba-tx)]`}
    >
      {/* Atmospheric glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[5%] -top-[10%] h-[40%] w-[40%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--fba-ind) 8%, transparent), transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--fba-ind) 6%, transparent), transparent 70%)",
          filter: "blur(120px)",
        }}
      />

      {/* Top brand lockup */}
      <header className="relative z-50 flex items-center justify-center px-4 pb-2 pt-8 sm:pt-10">
        <p className="text-center text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--fba-tx)] sm:text-[40px] sm:leading-[1.05]">
          {academyName}
        </p>
        <div className="absolute right-4 top-6 sm:right-8 sm:top-8">
          <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
        </div>
      </header>

      <main className="relative z-10 flex flex-grow items-center justify-center px-4 py-8">
        <section aria-labelledby="tenant-unavailable-title" className={`fba-ve-rise ${cardClass}`}>
          <StatusIcon tone={copy.iconTone} />

          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fba-tx2)]">
            {academyName}
          </p>
          <h1
            id="tenant-unavailable-title"
            className="mb-3 text-[22px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--fba-tx)] sm:text-[24px]"
          >
            {copy.title}
          </h1>
          <p className="mx-auto mb-8 max-w-[380px] text-[15px] leading-[1.65] text-[var(--fba-tx2)]">
            {copy.description}
          </p>

          <div className="flex flex-col items-center gap-4">
            {isTransient ? (
              <button
                type="button"
                onClick={() => {
                  window.location.assign(retryTarget);
                }}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--fba-ind)] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[var(--fba-ind-d)] active:scale-[0.98]"
              >
                {autoRetryArmed ? "Retrying…" : "Try again"}
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg border-2 border-[var(--fba-ind)] px-6 py-3.5 text-[15px] font-semibold text-[var(--fba-ind)] no-underline transition-all hover:bg-[var(--fba-ind)] hover:text-white active:scale-[0.98]"
              >
                Admin sign in
              </Link>
            )}
            <GoBackButton />
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-1 px-4 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fba-tx3)]">
          Request ID: {requestId}
        </p>
        <p className="text-[11px] text-[var(--fba-tx3)]">
          © {new Date().getFullYear()} {academyName}
        </p>
      </footer>
    </div>
  );
}
