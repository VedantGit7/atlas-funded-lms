"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TenantBrandMark } from "@/components/patterns/TenantBrandMark";
import { FAQ_DATA } from "./landing-data";
import { captureLandingCtaClick } from "./landing-analytics";
import { FbaDarkModeButton } from "@/components/theme/FbaDarkModeButton";
import "./fba-landing.css";

export function LandingFaq() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleFaqClick = useCallback((index: number) => {
    setOpenFaq((current) => (current === index ? null : index));
  }, []);

  return (
    <div id="faq" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-[52px] text-center">
          <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--fba-ind)]">
            FAQ
          </div>
          <h2 className="m-0 text-[40px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[32px]">
            Common Questions
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-[var(--fba-bdr)]">
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.q} className="border-b border-[var(--fba-bdr)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    handleFaqClick(index);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 bg-[var(--fba-surf)] px-[26px] py-[22px] text-left transition-colors hover:bg-[var(--fba-bg2)]"
                  aria-expanded={isOpen}
                >
                  <div className="text-sm font-semibold leading-[1.45] text-[var(--fba-tx)]">
                    {faq.q}
                  </div>
                  <div
                    className={`w-5 shrink-0 text-center text-[22px] font-light leading-none ${
                      isOpen ? "text-[var(--fba-ind)]" : "text-[var(--fba-tx3)]"
                    }`}
                    aria-hidden
                  >
                    {isOpen ? "−" : "+"}
                  </div>
                </button>
                <div
                  className="overflow-hidden transition-[max-height,opacity,padding] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    maxHeight: isOpen ? "320px" : "0px",
                    opacity: isOpen ? 1 : 0,
                    paddingLeft: "26px",
                    paddingRight: "26px",
                    paddingBottom: isOpen ? "22px" : "0px",
                  }}
                >
                  <div className="text-sm leading-[1.8] text-[var(--fba-tx2)]">{faq.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingNav({
  darkMode,
  onToggleDark,
  publicName,
  authCta = null,
  logoUrl = null,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
  publicName?: string | null;
  /** When present, replaces Sign In (resolved on the server from the session). */
  authCta?: { label: string; href: string } | null;
  /** The tenant's own logo; without one their initials mark is shown. */
  logoUrl?: string | null;
}) {
  // Neutral fallback: this nav renders every tenant's public landing, so a
  // "FundedBeyond" default put tenant #1's name on every academy's home page.
  //
  // The " Academy" suffix below is split out only so it can be de-emphasised
  // typographically for names that already end in it ("FundedBeyond" +
  // "Academy"). It used to be appended unconditionally, which rendered
  // "Academy Academy" for a tenant with no publicName, and would have made
  // "Northwind Institute" read "Northwind Institute Academy".
  const fullName = publicName?.trim() || "Academy";
  const hasAcademySuffix = /\s*Academy\s*$/i.test(fullName);
  const brandName = hasAcademySuffix
    ? fullName.replace(/\s*Academy\s*$/i, "") || fullName
    : fullName;

  const navLinks = [
    { id: "how", label: "How It Works" },
    { id: "diagnostic", label: "Diagnostic" },
    { id: "courses", label: "Courses" },
    { id: "faq", label: "FAQ" },
  ];

  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      const navHeight = 62;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    },
    [],
  );

  const primaryAuthHref = authCta?.href ?? "/login";
  const primaryAuthLabel = authCta?.label ?? "Sign In";

  return (
    <div className="sticky top-0 z-[100] border-b border-[var(--fba-bdr)] bg-[var(--fba-nav-bg)] backdrop-blur-[8px]">
      <div className="mx-auto flex h-[62px] max-w-[1100px] items-center justify-between gap-6 px-7 max-[1024px]:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <TenantBrandMark
            logoUrl={logoUrl}
            name={fullName}
            size={30}
            className="h-[30px] w-[30px] shrink-0 rounded-full"
          />
          <div>
            <span className="text-[13px] font-extrabold leading-none text-[var(--fba-tx)]">
              {brandName}
            </span>
            {hasAcademySuffix ? (
              <span className="text-[13px] font-normal leading-none text-[var(--fba-tx3)]">
                {" "}
                Academy
              </span>
            ) : null}
          </div>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Landing sections">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(event) => {
                handleNavClick(event, link.id);
              }}
              className="text-[13px] font-medium text-[var(--fba-tx2)] no-underline transition-colors hover:text-[var(--fba-tx)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-2.5">
          <FbaDarkModeButton darkMode={darkMode} onToggle={onToggleDark} />
          <Link
            href={primaryAuthHref}
            className="hidden rounded-lg border-[1.5px] border-[var(--fba-bdr2)] bg-[var(--fba-surf)] px-5 py-[10px] text-[13px] font-semibold text-[var(--fba-tx)] no-underline transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)] sm:inline-block"
          >
            {primaryAuthLabel}
          </Link>
          <Link
            href="/diagnostic"
            onClick={() => {
              captureLandingCtaClick("nav_start_free");
            }}
            className="rounded-lg bg-[var(--fba-ind)] px-5 py-[11px] text-xs font-bold text-white no-underline transition-colors hover:bg-[var(--fba-ind-d)]"
          >
            Start Free →
          </Link>
        </div>
      </div>
    </div>
  );
}
