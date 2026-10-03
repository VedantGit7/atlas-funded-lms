"use client";

import Link from "next/link";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";

type ShellAccessBlockedScreenProps = Readonly<{
  branding: PublicTenantBranding;
  title: string;
  description: string;
  requestId: string;
}>;

function LockIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-[var(--fba-tx2)]"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ShellAccessBlockedScreen({
  branding,
  title,
  description,
  requestId,
}: ShellAccessBlockedScreenProps) {
  const { darkMode, toggleDark } = useFbaTheme();
  const academyName = branding.publicName ?? branding.issuerName ?? "Academy";

  return (
    <div
      className={`fba-scope font-plus-jakarta-sans ${darkMode ? "fba-dark" : ""} relative flex min-h-screen flex-col overflow-hidden bg-[var(--fba-bg)] text-[var(--fba-tx)]`}
    >
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

      <header className="relative z-50 flex items-center justify-center px-4 pb-2 pt-8 sm:pt-10">
        <p className="text-center text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--fba-tx)] sm:text-[40px] sm:leading-[1.05]">
          {academyName}
        </p>
        <div className="absolute right-4 top-6 sm:right-8 sm:top-8">
          <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
        </div>
      </header>

      <main className="relative z-10 flex flex-grow items-center justify-center px-6 py-8">
        <section
          aria-labelledby="shell-access-blocked-title"
          className="fba-ve-rise w-full max-w-[480px] rounded-xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-8 text-center shadow-[0_4px_24px_color-mix(in_srgb,var(--fba-tx)_6%,transparent)]"
        >
          <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--fba-bg2)] motion-safe:animate-[fba-lock-pulse_4s_ease-in-out_infinite]">
              <LockIcon />
            </div>
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-4 border-[var(--fba-surf)] bg-[var(--fba-red)]"
            />
          </div>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--fba-tx3)]">
            {academyName}
          </p>
          <h1
            id="shell-access-blocked-title"
            className="mb-4 text-[22px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--fba-tx)] sm:text-[24px]"
          >
            {title}
          </h1>

          <p
            role="alert"
            className="mx-auto mb-8 max-w-[320px] text-[15px] leading-[1.65] text-[var(--fba-tx2)]"
          >
            {description}
          </p>

          <div className="mx-auto mb-8 h-px w-12 bg-[var(--fba-bdr)]" />

          <div className="flex flex-col items-center gap-1 opacity-80">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fba-tx3)]">
              Security trace
            </p>
            <p className="font-mono text-[11px] text-[var(--fba-tx2)]">{requestId}</p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex justify-center gap-4 px-8 py-6">
        <Link
          href="/privacy"
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fba-tx3)] no-underline transition-colors hover:text-[var(--fba-tx)]"
        >
          Privacy policy
        </Link>
        <span className="text-[10px] text-[var(--fba-bdr)]" aria-hidden>
          •
        </span>
        <Link
          href="/terms"
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fba-tx3)] no-underline transition-colors hover:text-[var(--fba-tx)]"
        >
          Terms of service
        </Link>
      </footer>
    </div>
  );
}
