"use client";

import Link from "next/link";

export function ConsolePreviewCard() {
  const tenants = [
    { name: "Meridian Trading School", domain: "learn.meridian.io", learners: "2,140", status: "Active", tone: "grn" as const },
    { name: "Northbridge Institute", domain: "academy.northbridge.edu", learners: "5,028", status: "Active", tone: "grn" as const },
    { name: "Atelier Skills Lab", domain: "atelier.atlas.dev", learners: "318", status: "Provisioning", tone: "amb" as const },
  ];

  return (
    <div className="w-full max-w-[460px] shrink-0 max-[900px]:max-w-none">
      <div className="rounded-[18px] border-[1.5px] border-[var(--atl-bdr)] bg-[var(--atl-surf)] p-[26px] shadow-[0_18px_50px_rgba(12,19,34,0.12)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-[var(--atl-tx)]">Academies</div>
            <div className="mt-0.5 text-[11px] text-[var(--atl-tx3)]">Platform console</div>
          </div>
          <div className="rounded-lg bg-[var(--atl-acc)] px-3 py-[7px] text-[11px] font-bold text-white">
            New tenant
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {tenants.map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between gap-3 rounded-[11px] border border-[var(--atl-bdr)] bg-[var(--atl-bg2)] px-3.5 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold text-[var(--atl-tx)]">
                  {t.name}
                </div>
                <div className="truncate text-[11px] text-[var(--atl-tx3)]">{t.domain}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[var(--atl-tx)]">{t.learners}</div>
                  <div className="text-[9.5px] uppercase tracking-[0.08em] text-[var(--atl-tx3)]">
                    learners
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${
                    t.tone === "grn"
                      ? "bg-[color-mix(in_srgb,var(--atl-grn)_14%,transparent)] text-[var(--atl-grn)]"
                      : "bg-[color-mix(in_srgb,#d97706_16%,transparent)] text-[#b45309]"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--atl-bdr)] pt-4">
          <span className="text-[11px] text-[var(--atl-tx2)]">3 academies, fully isolated</span>
          <span className="text-[11px] font-bold text-[var(--atl-acc)]">View all</span>
        </div>
      </div>
    </div>
  );
}

export function AuthoringPreviewCard() {
  const lessons = [
    { title: "Risk and position sizing", state: "Published", done: true },
    { title: "Reading the order book", state: "Published", done: true },
    { title: "Evaluation rule checklist", state: "Draft", done: false },
  ];

  return (
    <div className="w-full max-w-[460px] shrink-0 max-[900px]:max-w-none">
      <div className="rounded-[18px] border-[1.5px] border-[var(--atl-bdr)] bg-[var(--atl-surf)] p-[26px] shadow-[0_18px_50px_rgba(12,19,34,0.12)]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--atl-tx3)]">
          Course
        </div>
        <div className="mb-5 text-[16px] font-bold leading-[1.25] text-[var(--atl-tx)]">
          Funded Trader Foundations
        </div>
        <div className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <div
              key={lesson.title}
              className="flex items-center gap-3 rounded-[10px] border border-[var(--atl-bdr)] bg-[var(--atl-bg2)] px-3.5 py-[11px]"
            >
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  lesson.done
                    ? "bg-[var(--atl-acc)] text-white"
                    : "border border-[var(--atl-bdr2)] text-[var(--atl-tx3)]"
                }`}
              >
                {lesson.done ? "\u2713" : ""}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--atl-tx)]">
                {lesson.title}
              </span>
              <span
                className={`shrink-0 text-[10.5px] font-semibold ${
                  lesson.done ? "text-[var(--atl-grn)]" : "text-[var(--atl-tx3)]"
                }`}
              >
                {lesson.state}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-[10px] bg-[var(--atl-acc-l)] px-3 py-2.5">
            <div className="text-[15px] font-extrabold leading-none text-[var(--atl-acc)]">68%</div>
            <div className="mt-1 text-[9.5px] text-[var(--atl-tx2)]">avg progress</div>
          </div>
          <div className="rounded-[10px] bg-[var(--atl-bg2)] px-3 py-2.5">
            <div className="text-[15px] font-extrabold leading-none text-[var(--atl-tx)]">12</div>
            <div className="mt-1 text-[9.5px] text-[var(--atl-tx2)]">lessons</div>
          </div>
          <div className="rounded-[10px] bg-[var(--atl-bg2)] px-3 py-2.5">
            <div className="text-[15px] font-extrabold leading-none text-[var(--atl-tx)]">v4</div>
            <div className="mt-1 text-[9.5px] text-[var(--atl-tx2)]">published</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBullet({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-[13px]">
      <div className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--atl-acc-l)]">
        <div className="h-[7px] w-[7px] rounded-full bg-[var(--atl-acc)]" />
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold leading-[1.2] text-[var(--atl-tx)]">{title}</div>
        <div className="text-[13px] leading-[1.65] text-[var(--atl-tx2)]">{body}</div>
      </div>
    </div>
  );
}

export function PlatformSection() {
  return (
    <div
      id="platform"
      className="border-y border-[var(--atl-bdr)] bg-[var(--atl-bg2)] px-7 py-24 max-[768px]:px-4 max-[768px]:py-16"
    >
      <div className="mx-auto flex max-w-[1140px] items-center gap-[72px] max-[900px]:flex-col max-[900px]:gap-10">
        <div className="min-w-0 flex-1">
          <h2 className="mb-[18px] text-[38px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[30px]">
            One console. Every academy, fully separate.
          </h2>
          <p className="mb-[30px] text-[15px] leading-[1.75] text-[var(--atl-tx2)]">
            Provision, configure, and operate any number of branded academies from a single platform
            console. Tenants are resolved by hostname and isolated down to the data layer.
          </p>
          <div className="mb-9 flex flex-col gap-4">
            <FeatureBullet
              title="Host-based tenancy"
              body="Each academy is selected by its domain, with roles and data scoped per tenant."
            />
            <FeatureBullet
              title="Provision in minutes"
              body="Create a tenant, assign an owner, and the academy is ready to brand and fill."
            />
            <FeatureBullet
              title="Operator controls"
              body="Feature flags, entitlements, and audit trails live in the console, never in tenant code."
            />
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--atl-acc)] px-[26px] py-[15px] text-sm font-bold text-white no-underline transition-colors hover:bg-[var(--atl-acc-d)]"
          >
            Book a demo
          </a>
        </div>
        <ConsolePreviewCard />
      </div>
    </div>
  );
}

export function AuthoringSection() {
  return (
    <div id="features" className="px-7 py-24 max-[768px]:px-4 max-[768px]:py-16">
      <div className="mx-auto flex max-w-[1140px] items-center gap-[72px] max-[900px]:flex-col-reverse max-[900px]:gap-10">
        <AuthoringPreviewCard />
        <div className="min-w-0 flex-1">
          <h2 className="mb-[18px] text-[38px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--atl-tx)] max-[768px]:text-[30px]">
            Author once, publish with confidence
          </h2>
          <p className="mb-[30px] text-[15px] leading-[1.75] text-[var(--atl-tx2)]">
            Build courses, learning paths, and assessments with versioned publishing and a review
            step. Your team ships updates without breaking what learners already depend on.
          </p>
          <div className="mb-9 flex flex-col gap-4">
            <FeatureBullet
              title="Structured content"
              body="Courses, lessons, and paths map to the way your curriculum actually progresses."
            />
            <FeatureBullet
              title="Versioned publishing"
              body="Draft, review, and publish. Roll forward cleanly while learners stay on stable content."
            />
            <FeatureBullet
              title="Assessments and certificates"
              body="Quiz learners, track mastery, and issue verifiable credentials on completion."
            />
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-[var(--atl-acc)] bg-[var(--atl-surf)] px-[26px] py-[15px] text-sm font-bold text-[var(--atl-acc)] no-underline transition-colors hover:bg-[var(--atl-acc-l)]"
          >
            Sign in to console
          </Link>
        </div>
      </div>
    </div>
  );
}
