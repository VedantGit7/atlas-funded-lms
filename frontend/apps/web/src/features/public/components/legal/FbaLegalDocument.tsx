"use client";

import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useCallback } from "react";
import { TenantBrandMark } from "@/components/patterns/TenantBrandMark";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";
import type { LegalDocument } from "./legal-types";
import { LegalContentRenderer } from "./LegalContentRenderer";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

type FbaLegalDocumentProps = {
  document: LegalDocument;
  publicName?: string;
  /** The tenant's own logo; without one their initials mark is shown. */
  logoUrl?: string | null;
};

export function FbaLegalDocument({
  document: legalDocument,
  // Neutral fallback: this shell renders every tenant's legal pages, so a
  // "FundedBeyond Academy" default named tenant #1 in every academy's footer
  // and copyright line.
  publicName = "Academy",
  logoUrl = null,
}: FbaLegalDocumentProps) {
  const { darkMode, toggleDark } = useFbaTheme();
  const brandShort = publicName.replace(/\s*Academy\s*$/i, "") || publicName;
  const hasAcademySuffix = /academy/i.test(publicName);

  const handleTocClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      const target = globalThis.document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    },
    [],
  );

  const siblingHref = legalDocument.slug === "terms" ? "/privacy" : "/terms";
  const siblingLabel = legalDocument.slug === "terms" ? "Privacy Policy" : "Terms and Conditions";

  return (
    <div
      className={`fba-scope ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""} min-h-screen bg-[var(--fba-bg)]`}
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
            <div>
              <span className="text-[13px] font-extrabold leading-none text-[var(--fba-tx)]">
                {brandShort}
              </span>
              {hasAcademySuffix ? (
                <span className="text-[13px] font-normal leading-none text-[var(--fba-tx3)]">
                  {" "}
                  Academy
                </span>
              ) : null}
            </div>
          </Link>
          <div className="flex items-center gap-2.5">
            <FbaDarkModeButton darkMode={darkMode} onToggle={toggleDark} />
            <Link
              href="/login"
              className="rounded-lg border-[1.5px] border-[var(--fba-bdr2)] bg-[var(--fba-surf)] px-4 py-2 text-[13px] font-semibold text-[var(--fba-tx)] no-underline transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-7 py-12 max-[768px]:px-4 max-[768px]:py-8">
        <div className="mb-10 border-b border-[var(--fba-bdr)] pb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fba-ind-tx)]">
            Legal
          </p>
          <h1 className="mb-3 text-[40px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--fba-tx)] max-[768px]:text-[32px]">
            {legalDocument.title}
          </h1>
          <p className="max-w-[720px] text-[16px] leading-[1.65] text-[var(--fba-tx2)]">
            {legalDocument.subtitle}
          </p>
          <p className="mt-4 text-[13px] text-[var(--fba-tx3)]">
            Last updated: {legalDocument.lastUpdated}
          </p>
        </div>

        <div className="flex gap-12 max-[1024px]:flex-col max-[1024px]:gap-8">
          <aside className="w-[240px] shrink-0 max-[1024px]:w-full">
            <nav
              aria-label="Table of contents"
              className="fba-scroll-invisible sticky top-[88px] max-h-[calc(100vh-112px)] space-y-2 overflow-y-auto overscroll-contain max-[1024px]:static max-[1024px]:max-h-none max-[1024px]:overflow-visible"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fba-tx3)]">
                On this page
              </p>
              {legalDocument.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(event) => {
                    handleTocClick(event, section.id);
                  }}
                  className="block rounded-[10px] border border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-3 py-3 no-underline transition-colors hover:border-[var(--fba-bdr2)] hover:bg-[var(--fba-bg2)]"
                >
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fba-ind-tx)]">
                    {section.sectionNumber}
                  </span>
                  <span className="text-[13px] font-medium leading-snug text-[var(--fba-tx)]">
                    {section.title}
                  </span>
                </a>
              ))}
              <div className="mt-4 border-t border-[var(--fba-bdr)] pt-4">
                <Link
                  href={siblingHref}
                  className="text-[13px] font-semibold text-[var(--fba-ind-tx)] no-underline hover:underline"
                >
                  View {siblingLabel}
                </Link>
              </div>
            </nav>
          </aside>

          <article className="min-w-0 flex-1">
            {legalDocument.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className={`scroll-mt-[88px] ${index > 0 ? "mt-14 border-t border-[var(--fba-bdr)] pt-14" : ""}`}
              >
                <div className="mb-6">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fba-ind-tx)]">
                    {section.sectionNumber}
                  </span>
                  <h2 className="text-[26px] font-extrabold leading-[1.25] tracking-[-0.01em] text-[var(--fba-tx)] max-[768px]:text-[22px]">
                    {section.title}
                  </h2>
                </div>
                <LegalContentRenderer blocks={section.blocks} />
              </section>
            ))}
          </article>
        </div>
      </div>

      <footer className="mt-16 border-t border-[var(--fba-bdr)] bg-[var(--fba-footer-bg)] px-7 py-10 max-[768px]:px-4">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} {publicName}. All rights reserved.
          </p>
          <p className="text-[12px] text-white/30">
            Not financial advice. Trading involves significant risk of loss.
          </p>
        </div>
      </footer>
    </div>
  );
}
