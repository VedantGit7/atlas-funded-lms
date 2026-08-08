"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import { FUNDED_BEYOND_LOGO_URL } from "@/lib/brand";
import type { z } from "zod";
import type { PublicLandingPageSchema } from "@atlas/contracts/domain-branding/schemas/public-landing";
import {
  HOW_IT_WORKS,
  STATS,
  TESTIMONIALS,
  WHO_ITS_FOR,
} from "./landing-data";
import { DiagnosticSection, ToolsSection } from "./LandingSections";
import { LandingFaq, LandingNav } from "./LandingInteractive";
import { captureLandingCtaClick } from "./landing-analytics";
import { useFbaTheme } from "@/components/theme/use-fba-theme";
import "@/components/theme/fba-theme.css";
import "./fba-landing.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

type PublicLandingPage = z.infer<typeof PublicLandingPageSchema>;

type FundedBeyondLandingProps = {
  landing: PublicLandingPage;
  /** Server-resolved: Dashboard when signed in, otherwise Sign In. */
  authCta?: { label: string; href: string } | null;
};

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--fba-ind)]">
      {children}
    </div>
  );
}

function CheckRow({ children, light }: { children: string; light?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`shrink-0 text-[13px] font-bold ${light ? "text-[var(--fba-gld-b)]" : "text-[var(--fba-grn)]"}`}
      >
        ✓
      </span>
      <span
        className={`text-[13px] leading-[1.4] ${light ? "text-white/75" : "text-[var(--fba-tx2)]"}`}
      >
        {children}
      </span>
    </div>
  );
}

export function FundedBeyondLanding({ landing, authCta = null }: FundedBeyondLandingProps) {
  const { darkMode, toggleDark } = useFbaTheme();
  const heroAccent = landing.headline?.includes("Trader")
    ? landing.headline
    : "Trader the Right Way.";
  const ctaLabel = landing.primaryCta?.label || "Take the Free Diagnostic →";
  const ctaHref = landing.primaryCta?.href || "/diagnostic";

  return (
    <div
      className={`fba-scope fba-landing ${plusJakarta.variable} ${darkMode ? "fba-dark" : ""}`}
    >
      <LandingNav
        darkMode={darkMode}
        onToggleDark={toggleDark}
        publicName={landing.publicName}
        authCta={authCta}
      />

      {/* Hero */}
      <div id="hero" className="px-7 pb-[76px] pt-[84px] text-center max-[768px]:px-4 max-[768px]:pt-16">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-[30px] inline-flex items-center gap-2 rounded-[40px] border border-[var(--fba-gld-b)] bg-[var(--fba-gld-l)] px-4 py-[7px]">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d97706]" />
            <span className="text-[11px] font-medium text-[#92400e]">
              Free Diagnostic - No Account Required
            </span>
          </div>
          <h1 className="mb-1 text-[58px] font-extrabold leading-[1.03] text-balance text-[var(--fba-tx)] max-[768px]:text-[40px]">
            Become a Funded
          </h1>
          <h1 className="mb-[26px] text-[58px] font-extrabold leading-[1.1] text-balance text-[var(--fba-ind)] max-[768px]:text-[40px]">
            {heroAccent}
          </h1>
          <p className="mx-auto mb-[38px] max-w-[540px] text-[17px] leading-[1.75] text-pretty text-[var(--fba-tx2)]">
            {landing.subheadline ||
              "Start with a free trader-readiness diagnostic, build daily habits with free tools, then go deeper with structured courses, designed to get you through your first funded evaluation."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={ctaHref}
              onClick={() => captureLandingCtaClick("hero_primary_cta")}
              className="rounded-[10px] bg-[var(--fba-ind)] px-[30px] py-[17px] text-sm font-bold text-white no-underline transition-colors hover:bg-[var(--fba-ind-d)]"
            >
              {ctaLabel}
            </Link>
            <a
              href="#courses"
              className="rounded-[10px] border-[1.5px] border-[var(--fba-bdr2)] bg-[var(--fba-surf)] px-[30px] py-[17px] text-sm font-semibold text-[var(--fba-tx)] no-underline transition-colors hover:border-[var(--fba-tx3)] hover:bg-[var(--fba-bg2)]"
            >
              Browse Courses
            </a>
          </div>
          <div className="mt-5 text-xs text-[var(--fba-tx3)]">
            Trusted by{" "}
            <span className="font-bold text-[var(--fba-ind)]">4,200+</span> traders · No credit card
            required · Cancel anytime
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-y border-[var(--fba-bdr)] bg-[var(--fba-bg2)]">
        <div className="mx-auto flex max-w-[1100px] px-7 max-[768px]:grid max-[768px]:grid-cols-2 max-[768px]:px-4">
          {STATS.map((stat, i) => {
            const valueColor =
              "accent" in stat && stat.accent
                ? "text-[var(--fba-ind)]"
                : "gold" in stat && stat.gold
                  ? "text-[var(--fba-gld)]"
                  : "text-[var(--fba-tx)]";
            return (
            <div
              key={stat.label}
              className={`flex-1 px-4 py-[30px] text-center max-[768px]:border-0 ${
                i < STATS.length - 1 ? "border-r border-[var(--fba-bdr)] max-[768px]:border-r-0" : ""
              }`}
            >
              <div className={`text-[34px] font-extrabold leading-none ${valueColor}`}>
                {stat.value}
              </div>
              <div className="mt-[7px] text-xs font-medium tracking-[0.01em] text-[var(--fba-tx3)]">
                {stat.label}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div id="how" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionEyebrow>How It Works</SectionEyebrow>
            <h2 className="mb-3.5 text-[40px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[32px]">
              Your Path to Getting Funded
            </h2>
            <p className="mx-auto max-w-[500px] text-base leading-[1.7] text-[var(--fba-tx2)]">
              Three clear stages, from knowing where you stand to attempting your evaluation with
              genuine confidence.
            </p>
          </div>
          <div className="flex gap-6 max-[900px]:flex-col">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="flex-1 rounded-[14px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-[34px_28px] transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-[var(--fba-bdr2)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-[22px] text-[52px] font-extrabold leading-none text-[var(--fba-gld-b)]">
                  {item.step}
                </div>
                <div className="mb-3 text-lg font-bold leading-[1.25] text-[var(--fba-tx)]">
                  {item.title}
                </div>
                <p className="mb-[22px] text-sm leading-[1.75] text-[var(--fba-tx2)]">{item.body}</p>
                <a
                  href={item.link.href}
                  className="text-[13px] font-semibold text-[var(--fba-ind)] no-underline transition-colors hover:text-[var(--fba-ind-d)]"
                >
                  {item.link.label}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DiagnosticSection />
      <ToolsSection />

      {/* Pricing */}
      <div
        id="courses"
        className="border-y border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16"
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionEyebrow>Courses &amp; Pricing</SectionEyebrow>
            <h2 className="mb-3.5 text-[40px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[32px]">
              Start Free. Go Deeper When You&apos;re Ready.
            </h2>
            <p className="mx-auto max-w-[480px] text-base leading-[1.7] text-[var(--fba-tx2)]">
              Everything starts free. Upgrade to structured courses when you&apos;re ready for real
              depth.
            </p>
          </div>
          <div className="flex items-stretch gap-5 max-[900px]:flex-col">
            {/* Starter */}
            <div className="flex flex-1 flex-col rounded-2xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-8">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fba-tx3)]">
                Starter
              </div>
              <div className="mb-1.5 text-[38px] font-extrabold leading-none text-[var(--fba-tx)]">
                Free
              </div>
              <div className="mb-7 text-[13px] text-[var(--fba-tx3)]">Always. No card needed.</div>
              <Link
                href="/signup"
                className="mb-7 block rounded-[9px] border-[1.5px] border-[var(--fba-bdr2)] bg-[var(--fba-bg2)] py-3.5 text-center text-[13px] font-bold text-[var(--fba-tx)] no-underline transition-colors hover:border-[var(--fba-tx3)]"
              >
                Get Started Free
              </Link>
              <div className="mb-6 h-px bg-[var(--fba-bdr)]" />
              <div className="flex flex-1 flex-col gap-[13px]">
                <CheckRow>Trader Readiness Diagnostic</CheckRow>
                <CheckRow>Daily Habit Tracker</CheckRow>
                <CheckRow>Risk Calculator</CheckRow>
                <CheckRow>Trade Journal</CheckRow>
                <CheckRow>Community (read access)</CheckRow>
              </div>
            </div>
            {/* Foundation */}
            <div className="relative flex flex-1 flex-col rounded-2xl border-2 border-[var(--fba-ind)] bg-[var(--fba-ind)] p-8">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[40px] bg-[var(--fba-gld)] px-3.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                Most Popular
              </div>
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Foundation
              </div>
              <div className="mb-1.5 flex items-baseline gap-1.5">
                <div className="text-[38px] font-extrabold leading-none text-white">$49</div>
                <div className="text-[15px] font-medium text-white/50">/month</div>
              </div>
              <div className="mb-7 text-[13px] text-white/45">or $249 billed once</div>
              <Link
                href="/signup"
                className="mb-7 block rounded-[9px] bg-white py-3.5 text-center text-[13px] font-bold text-[var(--fba-ind)] no-underline transition-colors hover:bg-[var(--fba-ind-l)]"
              >
                Start Foundation
              </Link>
              <div className="mb-6 h-px bg-white/15" />
              <div className="flex flex-1 flex-col gap-[13px]">
                <CheckRow light>Everything in Starter</CheckRow>
                <CheckRow light>8 structured video courses</CheckRow>
                <CheckRow light>Evaluation strategy templates</CheckRow>
                <CheckRow light>Quiz assessments &amp; progress</CheckRow>
                <CheckRow light>Full community access</CheckRow>
                <CheckRow light>Firm-specific playbooks</CheckRow>
              </div>
            </div>
            {/* Pro */}
            <div className="flex flex-1 flex-col rounded-2xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-8">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fba-tx3)]">
                Pro
              </div>
              <div className="mb-1.5 flex items-baseline gap-1.5">
                <div className="text-[38px] font-extrabold leading-none text-[var(--fba-tx)]">$99</div>
                <div className="text-[15px] font-medium text-[var(--fba-tx3)]">/month</div>
              </div>
              <div className="mb-7 text-[13px] text-[var(--fba-tx3)]">or $497 billed once</div>
              <Link
                href="/signup"
                className="mb-7 block rounded-[9px] bg-[var(--fba-tx)] py-3.5 text-center text-[13px] font-bold text-[var(--fba-bg)] no-underline transition-opacity hover:opacity-90"
              >
                Start Pro
              </Link>
              <div className="mb-6 h-px bg-[var(--fba-bdr)]" />
              <div className="flex flex-1 flex-col gap-[13px]">
                <CheckRow>Everything in Foundation</CheckRow>
                <CheckRow>Advanced strategy courses (12 total)</CheckRow>
                <CheckRow>Weekly live Q&amp;A sessions</CheckRow>
                <CheckRow>Personalized diagnostic review</CheckRow>
                <CheckRow>1-on-1 course feedback</CheckRow>
                <CheckRow>Priority support</CheckRow>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionEyebrow>Success Stories</SectionEyebrow>
            <h2 className="m-0 text-[40px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[32px]">
              Traders Who Got It Right
            </h2>
          </div>
          <div className="flex gap-5 max-[900px]:flex-col">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex-1 rounded-2xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-[30px] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-4 text-sm font-bold tracking-[0.04em] text-[var(--fba-gld)]">
                  ★★★★★
                </div>
                <p className="mb-[22px] text-sm leading-[1.8] text-[var(--fba-tx2)]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--fba-tx)]">{t.name}</div>
                    <div className="mt-[5px] text-[11px] text-[var(--fba-tx3)]">{t.detail}</div>
                  </div>
                  <div className="rounded-md bg-[var(--fba-ind-l)] px-2.5 py-[5px]">
                    <div className="text-[10px] font-semibold text-[var(--fba-ind)]">{t.badge}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Who It's For */}
      <div
        id="about"
        className="border-y border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16"
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-14 text-center">
            <SectionEyebrow>Who It&apos;s For</SectionEyebrow>
            <h2 className="mb-3.5 text-[40px] font-extrabold leading-[1.1] text-[var(--fba-tx)] max-[768px]:text-[32px]">
              Built for Every Stage of the Journey
            </h2>
            <p className="mx-auto max-w-[500px] text-base leading-[1.7] text-[var(--fba-tx2)]">
              Whether you&apos;re just getting started or you&apos;ve failed evaluations before,
              there&apos;s a clear path forward from here.
            </p>
          </div>
          <div className="flex gap-5 max-[900px]:flex-col">
            {WHO_ITS_FOR.map((item) => (
              <div
                key={item.step}
                className="flex-1 rounded-2xl border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-[30px_26px] transition-[box-shadow,border-color] hover:border-[var(--fba-bdr2)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-[18px] text-[36px] font-extrabold leading-none text-[var(--fba-ind-l)]">
                  {item.step}
                </div>
                <div className="mb-3 text-[17px] font-bold leading-[1.25] text-[var(--fba-tx)]">
                  {item.title}
                </div>
                <p className="m-0 text-[13px] leading-[1.75] text-[var(--fba-tx2)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LandingFaq />

      {/* Final CTA */}
      <div className="bg-[var(--fba-ind)] px-7 py-[88px] text-center max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[620px]">
          <div className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">
            Start Today
          </div>
          <h2 className="mb-5 text-[44px] font-extrabold leading-[1.08] text-balance text-white max-[768px]:text-[32px]">
            Your First Funded Account Starts With Knowing Where You Stand
          </h2>
          <p className="mx-auto mb-[38px] max-w-[460px] text-base leading-[1.75] text-white/55">
            Take the free diagnostic. No account. No credit card. Just the clearest picture
            you&apos;ll ever get of your evaluation readiness.
          </p>
          <Link
            href="/diagnostic"
            onClick={() => captureLandingCtaClick("final_cta")}
            className="inline-flex items-center gap-2 rounded-[11px] bg-white px-9 py-[18px] text-[15px] font-bold text-[var(--fba-ind)] no-underline transition-colors hover:bg-[var(--fba-ind-l)]"
          >
            Take the Free Diagnostic →
          </Link>
          <div className="mt-3.5 text-xs text-white/30">
            Free forever · 5 minutes · No signup required
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[var(--fba-footer-bg)] px-7 pb-10 pt-16 max-[768px]:px-4">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-[52px] flex flex-wrap gap-14">
            <div className="min-w-[220px] flex-[2]">
              <div className="mb-[18px] flex items-center gap-2">
                <Image
                  src={FUNDED_BEYOND_LOGO_URL}
                  alt=""
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] shrink-0 rounded-full"
                />
                <span className="text-[13px] font-extrabold leading-none text-white">
                  FundedBeyond Academy
                </span>
              </div>
              <p className="m-0 max-w-[260px] text-[13px] leading-[1.75] text-white/38">
                {landing.footerText ||
                  "The prop trading academy that prepares you to pass funded evaluations, the right way, the first time."}
              </p>
            </div>
            {[
              {
                title: "Platform",
                links: [
                  { label: "Free Diagnostic", href: "/diagnostic" },
                  { label: "Practice Tools", href: "#tools" },
                  { label: "Courses", href: "#courses" },
                  { label: "Pricing", href: "#courses" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About", href: "#about" },
                  { label: "Blog", href: "#" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Contact", href: "#" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Disclaimer", href: "/terms#disclaimers" },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="min-w-[120px] flex-1">
                <div className="mb-[18px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                  {col.title}
                </div>
                <div className="flex flex-col gap-[11px]">
                  {col.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="text-[13px] text-white/45 no-underline transition-colors hover:text-white/80"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-[26px]">
            <div className="text-xs text-white/22">
              © 2025 FundedBeyond Academy. All rights reserved.
            </div>
            <div className="text-xs text-white/18">
              Not financial advice. Trading involves significant risk of loss.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
