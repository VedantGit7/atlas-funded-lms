"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import { FUNDED_BEYOND_LOGO_URL } from "@/lib/brand";
import { ShellSkipLink } from "./shared/ShellSkipLink";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

type AuthShellProps = Readonly<{
  branding: PublicTenantBranding;
  requestId: string;
  children: React.ReactNode;
}>;

const BRAND_HIGHLIGHTS = [
  "Free trader-readiness diagnostic",
  "Daily habit, risk, and journaling tools",
  "Structured funded-evaluation courses",
];

export function AuthShell({ branding, requestId, children }: AuthShellProps) {
  const { darkMode, toggleDark } = useFbaTheme();

  const fullName = branding.publicName ?? "FundedBeyond Academy";
  const brandName = fullName.replace(/\s*Academy\s*$/i, "") || "FundedBeyond";
  const hasAcademySuffix = /academy/i.test(fullName);

  return (
    <div
      className={`fba-scope ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""} flex min-h-screen`}
    >
      <ShellSkipLink />

      {/* Left: brand panel */}
      <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-[var(--fba-ind)] p-10 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, #ffffff 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        <Link
          href="/"
          aria-label={`${fullName} home`}
          className="relative z-10 flex items-center gap-3 no-underline transition-opacity hover:opacity-90"
        >
          <Image
            src={FUNDED_BEYOND_LOGO_URL}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full"
          />
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold uppercase tracking-tight text-white">
              {brandName}
            </div>
            {hasAcademySuffix ? (
              <div className="text-[13px] font-medium text-white/80">Academy</div>
            ) : null}
          </div>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="mb-4 text-[32px] font-extrabold leading-[1.2] tracking-[-0.01em] text-white">
            Trade the right way.
          </h2>
          <p className="mb-8 text-[18px] leading-[1.6] text-white/55">
            Pass your funded evaluation with structured prep, the right way, the first time.
          </p>
          <ul className="space-y-4">
            {BRAND_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-4 text-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white" aria-hidden />
                <span className="text-sm font-semibold">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[12px] uppercase leading-relaxed tracking-wider text-white/30">
          Not financial advice. Trading carries significant risk. FundedBeyond is an educational
          platform.
        </p>
      </aside>

      {/* Right: form panel */}
      <section className="relative flex w-full flex-col items-center justify-center bg-[var(--fba-bg)] p-5 md:w-[55%] md:p-10">
        <div className="absolute right-5 top-5 md:right-10 md:top-10">
          <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
        </div>

        <main id="main-content" className="flex w-full max-w-[400px] flex-col">
          {/* Mobile brand lockup (left panel is hidden on small screens) */}
          <Link
            href="/"
            aria-label={`${fullName} home`}
            className="mb-8 flex items-center gap-2.5 no-underline transition-opacity hover:opacity-90 md:hidden"
          >
            <Image
              src={FUNDED_BEYOND_LOGO_URL}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full"
            />
            <div className="text-[13px] font-extrabold text-[var(--fba-tx)]">
              {brandName}
              {hasAcademySuffix ? (
                <span className="font-medium text-[var(--fba-tx3)]"> Academy</span>
              ) : null}
            </div>
          </Link>

          {children}

          <p className="mt-10 text-center text-[11px] text-[var(--fba-tx3)]">
            Request ID: {requestId}
          </p>
        </main>
      </section>
    </div>
  );
}
