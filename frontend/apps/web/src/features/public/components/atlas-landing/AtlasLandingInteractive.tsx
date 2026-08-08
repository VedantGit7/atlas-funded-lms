"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ATLAS_FAQ } from "./atlas-landing-data";
import "./atlas-landing.css";

export function AtlasBrandMark({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-[8px] bg-[var(--atl-acc)] ${className ?? "h-[30px] w-[30px]"}`}
    >
      <span className="text-[13px] font-extrabold leading-none text-white">A</span>
    </div>
  );
}

export function useAtlasTheme() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("atlas-landing-dark");
    if (saved === "true") {
      setDarkMode(true);
    } else if (saved === null) {
      setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("atlas-landing-dark", String(next));
      return next;
    });
  }, []);

  return { darkMode: mounted ? darkMode : false, toggleDark, mounted };
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AtlasThemeToggle({
  darkMode,
  onToggle,
}: {
  darkMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-[var(--atl-bdr2)] bg-[var(--atl-surf)] text-[var(--atl-tx2)] transition-colors hover:border-[var(--atl-tx3)] hover:bg-[var(--atl-bg2)] hover:text-[var(--atl-tx)]"
    >
      {darkMode ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}

const NAV_LINKS = [
  { id: "platform", label: "Platform" },
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export function AtlasNav({
  darkMode,
  onToggleDark,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
}) {
  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      const navHeight = 64;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
    },
    [],
  );

  return (
    <div className="sticky top-0 z-[100] border-b border-[var(--atl-bdr)] bg-[var(--atl-nav-bg)] backdrop-blur-[10px]">
      <div className="mx-auto flex h-[64px] max-w-[1140px] items-center justify-between gap-6 px-7 max-[1024px]:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <AtlasBrandMark />
          <span className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--atl-tx)]">
            Atlas <span className="font-medium text-[var(--atl-tx3)]">LMS</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Landing sections">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(event) => handleNavClick(event, link.id)}
              className="text-[13px] font-medium text-[var(--atl-tx2)] no-underline transition-colors hover:text-[var(--atl-tx)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2.5">
          <AtlasThemeToggle darkMode={darkMode} onToggle={onToggleDark} />
          <Link
            href="/login"
            className="hidden rounded-lg border-[1.5px] border-[var(--atl-bdr2)] bg-[var(--atl-surf)] px-5 py-[10px] text-[13px] font-semibold text-[var(--atl-tx)] no-underline transition-colors hover:border-[var(--atl-tx3)] hover:bg-[var(--atl-bg2)] sm:inline-block"
          >
            Sign in
          </Link>
          <a
            href="#contact"
            className="rounded-lg bg-[var(--atl-acc)] px-5 py-[11px] text-xs font-bold text-white no-underline transition-colors hover:bg-[var(--atl-acc-d)]"
          >
            Book a demo
          </a>
        </div>
      </div>
    </div>
  );
}

export function AtlasFaq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleFaqClick = useCallback((index: number) => {
    setOpenFaq((current) => (current === index ? null : index));
  }, []);

  return (
    <div id="faq" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-[52px] text-center">
          <h2 className="m-0 text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[32px]">
            Questions, answered
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-[var(--atl-bdr)]">
          {ATLAS_FAQ.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.q} className="border-b border-[var(--atl-bdr)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => handleFaqClick(index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 bg-[var(--atl-surf)] px-[26px] py-[22px] text-left transition-colors hover:bg-[var(--atl-bg2)]"
                  aria-expanded={isOpen}
                >
                  <div className="text-sm font-semibold leading-[1.45] text-[var(--atl-tx)]">
                    {faq.q}
                  </div>
                  <div
                    className={`w-5 shrink-0 text-center text-[22px] font-light leading-none ${
                      isOpen ? "text-[var(--atl-acc)]" : "text-[var(--atl-tx3)]"
                    }`}
                    aria-hidden
                  >
                    {isOpen ? "\u2212" : "+"}
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
                  <div className="text-sm leading-[1.8] text-[var(--atl-tx2)]">{faq.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
