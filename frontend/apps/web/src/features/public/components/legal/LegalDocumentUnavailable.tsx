"use client";

import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { TenantBrandMark } from "@/components/patterns/TenantBrandMark";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

type LegalDocumentUnavailableProps = {
  title: string;
  publicName?: string;
  logoUrl?: string | null;
};

/**
 * Shown when a tenant has not published this legal document.
 *
 * Saying so plainly is the point of moving legal text into tenant config: the
 * previous behaviour served tenant #1's Terms and Privacy Policy from every
 * academy's domain, which is worse than showing nothing.
 */
export function LegalDocumentUnavailable({
  title,
  publicName = "Academy",
  logoUrl = null,
}: LegalDocumentUnavailableProps) {
  const { darkMode, toggleDark } = useFbaTheme();

  return (
    <div
      className={`fba-scope ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""} flex min-h-screen flex-col bg-[var(--fba-bg)]`}
    >
      <header className="sticky top-0 z-50 border-b border-[var(--fba-bdr)] bg-[var(--fba-nav-bg)] backdrop-blur-[8px]">
        <div className="mx-auto flex h-[62px] max-w-[1100px] items-center justify-between gap-4 px-7 max-[768px]:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
            <TenantBrandMark
              logoUrl={logoUrl}
              name={publicName}
              size={30}
              className="h-[30px] w-[30px] shrink-0 rounded-full"
            />
            <span className="text-[13px] font-extrabold leading-none text-[var(--fba-tx)]">
              {publicName}
            </span>
          </Link>
          <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
        </div>
      </header>

      <main className="flex flex-grow items-center justify-center px-5 py-16">
        <div className="max-w-[520px] text-center">
          <h1 className="mb-3 text-[28px] font-extrabold tracking-[-0.02em] text-[var(--fba-tx)]">
            {title}
          </h1>
          <p className="mb-6 text-[15px] leading-[1.7] text-[var(--fba-tx2)]">
            {publicName} has not published {title.toLowerCase()} yet. Please contact them directly
            if you need a copy.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[10px] bg-[var(--fba-ind)] px-5 py-3 text-[14px] font-bold text-white no-underline transition-colors hover:bg-[var(--fba-ind-d)]"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
