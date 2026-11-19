"use client";

import Link from "next/link";
import { useCallback } from "react";
import { TenantBrandMark } from "@/components/patterns/TenantBrandMark";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";
import type { LegalDocument } from "./legal-types";
import { LegalContentRenderer } from "./LegalContentRenderer";

const LEGAL_PAGES: ReadonlyArray<{ slug: LegalDocument["slug"]; href: string; label: string }> = [
  { slug: "terms", href: "/terms", label: "Terms and Conditions" },
  { slug: "privacy", href: "/privacy", label: "Privacy Policy" },
  { slug: "disclaimer", href: "/disclaimer", label: "Disclaimer" },
];

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
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    },
    [],
  );

  const siblings = LEGAL_PAGES.filter((page) => page.slug !== legalDocument.slug);

  return (
    <div
      className={`fba-scope font-plus-jakarta-sans ${darkMode ? "fba-dark" : ""} min-h-screen bg-[var(--fba-bg)]`}
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

      {/* A plain, dense document: one readable column, small type, numbered
          sections and point-wise text, like a printed policy. */}
      <main className="mx-auto max-w-[780px] px-6 py-8 max-[768px]:px-4 max-[768px]:py-6">
        <h1 className="text-[24px] font-bold leading-tight text-[var(--fba-tx)] max-[768px]:text-[21px]">
          {legalDocument.title}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--fba-tx3)]">
          Last updated: {legalDocument.lastUpdated}
        </p>
        {legalDocument.subtitle ? (
          <p className="mt-3 text-[14px] leading-[1.6] text-[var(--fba-tx2)]">
            {legalDocument.subtitle}
          </p>
        ) : null}

        <nav
          aria-label="Contents"
          className="mt-5 rounded-md border border-[var(--fba-bdr)] bg-[var(--fba-surf)] px-4 py-3"
        >
          <p className="mb-1.5 text-[13px] font-semibold text-[var(--fba-tx)]">Contents</p>
          <ol className="list-decimal gap-x-8 pl-5 text-[13px] leading-[1.7] text-[var(--fba-tx2)] sm:columns-2">
            {legalDocument.sections.map((section) => (
              <li key={section.id} className="break-inside-avoid">
                <a
                  href={`#${section.id}`}
                  onClick={(event) => {
                    handleTocClick(event, section.id);
                  }}
                  className="text-[var(--fba-ind-tx)] no-underline hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="mt-2">
          {legalDocument.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="mt-6 scroll-mt-[80px]">
              <h2 className="mb-2 text-[16px] font-bold leading-snug text-[var(--fba-tx)]">
                {index + 1}. {section.title}
              </h2>
              <LegalContentRenderer blocks={section.blocks} />
            </section>
          ))}
        </article>

        <p className="mt-8 border-t border-[var(--fba-bdr)] pt-4 text-[13px] text-[var(--fba-tx2)]">
          See also:{" "}
          {siblings.map((page, index) => (
            <span key={page.slug}>
              {index > 0 ? " · " : null}
              <Link
                href={page.href}
                className="text-[var(--fba-ind-tx)] no-underline hover:underline"
              >
                {page.label}
              </Link>
            </span>
          ))}
        </p>
      </main>

      <footer className="mt-8 border-t border-[var(--fba-bdr)] bg-[var(--fba-footer-bg)] px-7 py-6 max-[768px]:px-4">
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
