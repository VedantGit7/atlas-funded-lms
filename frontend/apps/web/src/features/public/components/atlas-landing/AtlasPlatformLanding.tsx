import Link from "next/link";
import {
  ATLAS_CAPABILITIES,
  ATLAS_PRICING,
  ATLAS_STATS,
  ATLAS_STEPS,
  ATLAS_TESTIMONIALS,
} from "./atlas-landing-data";
import { AtlasBrandMark, AtlasFaq, AtlasLandingFrame } from "./AtlasLandingInteractive";
import { AuthoringSection, ConsolePreviewCard, PlatformSection } from "./AtlasLandingSections";
import "./atlas-landing.css";

function CheckRow({ children, light }: { children: string; light?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`shrink-0 text-[13px] font-bold ${light ? "text-white" : "text-[var(--atl-acc-tx)]"}`}
      >
        {"\u2713"}
      </span>
      <span
        className={`text-[13px] leading-[1.4] ${light ? "text-white/80" : "text-[var(--atl-tx2)]"}`}
      >
        {children}
      </span>
    </div>
  );
}

export function AtlasPlatformLanding() {
  return (
    <AtlasLandingFrame>
      {/* Hero */}
      <div className="relative overflow-hidden px-7 max-[768px]:px-4">
        <div className="pointer-events-none absolute inset-0 atl-hero-grid" aria-hidden />
        <div className="relative mx-auto flex max-w-[1140px] items-center gap-[64px] pb-24 pt-20 max-[900px]:flex-col max-[900px]:gap-12 max-[768px]:pt-14">
          <div className="min-w-0 flex-1">
            <div className="mb-6 inline-flex items-center gap-2 rounded-[40px] border border-[var(--atl-bdr2)] bg-[var(--atl-surf)] px-3.5 py-[7px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--atl-acc)]" />
              <span className="text-[11px] font-semibold text-[var(--atl-tx2)]">
                Multi-tenant white-label LMS
              </span>
            </div>
            <h1 className="mb-[22px] text-[54px] font-extrabold leading-[1.04] tracking-[-0.025em] text-balance text-[var(--atl-tx)] max-[768px]:text-[38px]">
              Launch your own learning platform, under your brand.
            </h1>
            <p className="mb-[34px] max-w-[480px] text-[17px] leading-[1.7] text-pretty text-[var(--atl-tx2)]">
              Atlas runs every academy on your domain, with your branding and your rules. One
              platform, any number of fully isolated tenants.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-[10px] bg-[var(--atl-acc)] px-[30px] py-[16px] text-sm font-bold text-white no-underline transition-colors hover:bg-[var(--atl-acc-d)]"
              >
                Book a demo
              </a>
              <Link
                href="/login"
                className="rounded-[10px] border-[1.5px] border-[var(--atl-bdr2)] bg-[var(--atl-surf)] px-[30px] py-[16px] text-sm font-semibold text-[var(--atl-tx)] no-underline transition-colors hover:border-[var(--atl-tx3)] hover:bg-[var(--atl-bg2)]"
              >
                Sign in
              </Link>
            </div>
          </div>
          <ConsolePreviewCard />
        </div>
      </div>

      {/* Stats */}
      <div className="border-y border-[var(--atl-bdr)] bg-[var(--atl-bg2)]">
        <div className="mx-auto flex max-w-[1140px] px-7 max-[768px]:grid max-[768px]:grid-cols-2 max-[768px]:px-4">
          {ATLAS_STATS.map((stat, i) => {
            const valueColor =
              "accent" in stat
                ? "text-[var(--atl-acc-tx)]"
                : "grn" in stat
                  ? "text-[var(--atl-grn)]"
                  : "text-[var(--atl-tx)]";
            return (
              <div
                key={stat.label}
                className={`flex-1 px-4 py-[30px] text-center max-[768px]:border-0 ${
                  i < ATLAS_STATS.length - 1
                    ? "border-r border-[var(--atl-bdr)] max-[768px]:border-r-0"
                    : ""
                }`}
              >
                <div className={`text-[32px] font-extrabold leading-none ${valueColor}`}>
                  {stat.value}
                </div>
                <div className="mt-[9px] text-xs font-medium tracking-[0.01em] text-[var(--atl-tx3)]">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Steps */}
      <div className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-14 max-w-[560px]">
            <h2 className="mb-3.5 text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[32px]">
              From signup to a live academy in a day
            </h2>
            <p className="text-base leading-[1.7] text-[var(--atl-tx2)]">
              No infrastructure to stand up and no platform branding to strip out. Provision, brand,
              and open enrollment.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
            {ATLAS_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-[14px] border-[1.5px] border-[var(--atl-bdr)] bg-[var(--atl-surf)] p-[32px_28px] transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-[var(--atl-bdr2)] hover:shadow-[0_10px_30px_rgba(12,19,34,0.07)]"
              >
                <div className="mb-[22px] text-[48px] font-extrabold leading-none text-[var(--atl-acc-l)]">
                  <span className="text-[var(--atl-acc-tx)]">{item.step}</span>
                </div>
                <div className="mb-3 text-lg font-bold leading-[1.25] text-[var(--atl-tx)]">
                  {item.title}
                </div>
                <p className="m-0 text-sm leading-[1.75] text-[var(--atl-tx2)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PlatformSection />
      <AuthoringSection />

      {/* Capabilities bento */}
      <div className="border-t border-[var(--atl-bdr)] bg-[var(--atl-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-14 max-w-[560px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--atl-acc-tx)]">
              Everything included
            </div>
            <h2 className="text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[32px]">
              A complete LMS, not a starter kit
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
            {ATLAS_CAPABILITIES.map((cap, i) => {
              const tinted = i === 0 || i === 4;
              return (
                <div
                  key={cap.title}
                  className={`rounded-[14px] border-[1.5px] p-[28px_26px] transition-[box-shadow,border-color] hover:shadow-[0_10px_30px_rgba(12,19,34,0.07)] ${
                    tinted
                      ? "border-transparent bg-[var(--atl-panel)] text-white"
                      : "border-[var(--atl-bdr)] bg-[var(--atl-surf)] hover:border-[var(--atl-bdr2)]"
                  }`}
                >
                  <div
                    className={`mb-2.5 text-[17px] font-bold leading-[1.25] ${
                      tinted ? "text-white" : "text-[var(--atl-tx)]"
                    }`}
                  >
                    {cap.title}
                  </div>
                  <p
                    className={`m-0 text-[13px] leading-[1.7] ${
                      tinted ? "text-white/80" : "text-[var(--atl-tx2)]"
                    }`}
                  >
                    {cap.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-14 text-center">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--atl-acc-tx)]">
              Pricing
            </div>
            <h2 className="mb-3.5 text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[32px]">
              Start building free. Pay when you launch.
            </h2>
            <p className="mx-auto max-w-[500px] text-base leading-[1.7] text-[var(--atl-tx2)]">
              Build your academy at no cost. Upgrade when you connect a custom domain and open to
              real learners.
            </p>
          </div>
          <div className="flex items-stretch gap-5 max-[900px]:flex-col">
            {ATLAS_PRICING.map((plan) => (
              <div
                key={plan.tier}
                className={`flex flex-1 flex-col rounded-2xl p-8 ${
                  plan.featured
                    ? "relative border-2 border-[var(--atl-panel)] bg-[var(--atl-panel)]"
                    : "border-[1.5px] border-[var(--atl-bdr)] bg-[var(--atl-surf)]"
                }`}
              >
                {plan.featured ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[40px] bg-[var(--atl-tx)] px-3.5 py-[5px] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--atl-bg)]">
                    Most popular
                  </div>
                ) : null}
                <div
                  className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    plan.featured ? "text-white/70" : "text-[var(--atl-tx3)]"
                  }`}
                >
                  {plan.tier}
                </div>
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <div
                    className={`text-[38px] font-extrabold leading-none ${
                      plan.featured ? "text-white" : "text-[var(--atl-tx)]"
                    }`}
                  >
                    {plan.price}
                  </div>
                  <div
                    className={`text-[14px] font-medium ${
                      plan.featured ? "text-white/70" : "text-[var(--atl-tx3)]"
                    }`}
                  >
                    {plan.cadence}
                  </div>
                </div>
                <div
                  className={`mb-7 text-[13px] ${plan.featured ? "text-white/70" : "text-[var(--atl-tx3)]"}`}
                >
                  {plan.note}
                </div>
                <a
                  href="#contact"
                  className={`mb-7 block rounded-[9px] py-3.5 text-center text-[13px] font-bold no-underline transition-colors ${
                    plan.featured
                      ? "bg-white text-[var(--atl-acc)] hover:opacity-90"
                      : "border-[1.5px] border-[var(--atl-bdr2)] bg-[var(--atl-bg2)] text-[var(--atl-tx)] hover:border-[var(--atl-tx3)]"
                  }`}
                >
                  {plan.cta}
                </a>
                <div
                  className={`mb-6 h-px ${plan.featured ? "bg-white/15" : "bg-[var(--atl-bdr)]"}`}
                />
                <div className="flex flex-1 flex-col gap-[13px]">
                  {plan.features.map((feature) => (
                    <CheckRow key={feature} light={plan.featured}>
                      {feature}
                    </CheckRow>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="border-y border-[var(--atl-bdr)] bg-[var(--atl-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-14 text-center">
            <h2 className="m-0 text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[32px]">
              Academies already running on Atlas
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-5 max-[900px]:grid-cols-1">
            {ATLAS_TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex flex-col rounded-2xl border-[1.5px] border-[var(--atl-bdr)] bg-[var(--atl-surf)] p-[30px] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(12,19,34,0.07)]"
              >
                <div className="mb-4 text-sm font-bold tracking-[0.04em] text-[var(--atl-acc-tx)]">
                  {"\u2605\u2605\u2605\u2605\u2605"}
                </div>
                <p className="mb-[22px] flex-1 text-sm leading-[1.8] text-[var(--atl-tx2)]">
                  {"\u201C"}
                  {t.quote}
                  {"\u201D"}
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--atl-tx)]">{t.name}</div>
                    <div className="mt-[5px] text-[11px] text-[var(--atl-tx3)]">{t.detail}</div>
                  </div>
                  <div className="rounded-md bg-[var(--atl-acc-l)] px-2.5 py-[5px]">
                    <div className="text-[10px] font-semibold text-[var(--atl-acc-tx)]">
                      {t.badge}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AtlasFaq />

      {/* Final CTA */}
      <div
        id="contact"
        className="bg-[var(--atl-panel)] px-7 py-[88px] text-center max-[768px]:px-4 max-[768px]:py-16"
      >
        <div className="mx-auto max-w-[620px]">
          <div className="mb-[18px] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
            Book a demo
          </div>
          <h2 className="mb-5 text-[44px] font-extrabold leading-[1.08] tracking-[-0.02em] text-balance text-white max-[768px]:text-[32px]">
            See your academy running under your own brand
          </h2>
          <p className="mx-auto mb-[38px] max-w-[470px] text-base leading-[1.75] text-white/70">
            Walk through provisioning, branding, and launch with our team. We will spin up a sample
            academy on a call.
          </p>
          <a
            href="mailto:sales@atlaslms.dev?subject=Atlas%20LMS%20demo"
            className="inline-flex items-center gap-2 rounded-[11px] bg-white px-9 py-[18px] text-[15px] font-bold text-[var(--atl-acc)] no-underline transition-colors hover:opacity-90"
          >
            Talk to our team
          </a>
          <div className="mt-3.5 text-xs text-white/70">
            Operators can also sign in at the platform console
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[var(--atl-footer-bg)] px-7 pb-10 pt-16 max-[768px]:px-4">
        <div className="mx-auto max-w-[1140px]">
          <div className="mb-[52px] flex flex-wrap gap-14">
            <div className="min-w-[220px] flex-[2]">
              <div className="mb-[18px] flex items-center gap-2.5">
                <AtlasBrandMark />
                <span className="text-[14px] font-extrabold leading-none text-white">
                  Atlas LMS
                </span>
              </div>
              <p className="m-0 max-w-[280px] text-[13px] leading-[1.75] text-white/70">
                The multi-tenant, white-label learning platform for academies and training teams.
              </p>
            </div>
            {[
              {
                title: "Platform",
                links: [
                  { label: "Console", href: "#platform" },
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Sign in", href: "/login" },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "Book a demo", href: "#contact" },
                  { label: "FAQ", href: "#faq" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy", href: "#" },
                  { label: "Terms", href: "#" },
                ],
              },
            ].map((col) => (
              <div key={col.title} className="min-w-[120px] flex-1">
                <div className="mb-[18px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {col.title}
                </div>
                <div className="flex flex-col gap-[11px]">
                  {col.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="text-[13px] text-white/50 no-underline transition-colors hover:text-white/85"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-[26px]">
            <div className="text-xs text-white/55">
              {"\u00A9"} 2026 Atlas LMS. All rights reserved.
            </div>
            <div className="text-xs text-white/55">
              Built for multi-tenant, white-label delivery.
            </div>
          </div>
        </div>
      </footer>
    </AtlasLandingFrame>
  );
}
