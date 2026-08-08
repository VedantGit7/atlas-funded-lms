"use client";

import Link from "next/link";

export type ProgressScoreReportTab =
  | "overview"
  | "progress"
  | "scores"
  | "cohorts"
  | "exports";

const TABS: Array<{ key: ProgressScoreReportTab; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin/reports/progress-score" },
  {
    key: "progress",
    label: "Progress",
    href: "/admin/reports/progress-score/progress",
  },
  {
    key: "scores",
    label: "Scores",
    href: "/admin/reports/progress-score/scores",
  },
  {
    key: "cohorts",
    label: "Cohorts",
    href: "/admin/reports/progress-score/cohorts",
  },
  {
    key: "exports",
    label: "Exports",
    href: "/admin/reports/progress-score/exports",
  },
];

export function ProgressScoreReportTabs({ active }: { active: ProgressScoreReportTab }) {
  const tabClass = (key: ProgressScoreReportTab) =>
    `whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
      active === key
        ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
        : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
    }`;

  return (
    <div className="flex items-center gap-8 overflow-x-auto border-b border-[var(--admin-border)]">
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tabClass(tab.key)}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
