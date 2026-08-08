"use client";

import Link from "next/link";

export type CustomFieldReportTab = "learners" | "fields" | "segments" | "cohorts" | "exports";

const TABS: Array<{ key: CustomFieldReportTab; label: string; href: string }> = [
  { key: "learners", label: "Learners", href: "/admin/reports/custom-field" },
  { key: "fields", label: "Fields", href: "/admin/reports/custom-field/fields" },
  { key: "segments", label: "Segments", href: "/admin/reports/custom-field/segments" },
  { key: "cohorts", label: "Cohorts", href: "/admin/reports/custom-field/cohorts" },
  { key: "exports", label: "Exports", href: "/admin/reports/custom-field/exports" },
];

export function CustomFieldReportTabs({ active }: { active: CustomFieldReportTab }) {
  const tabClass = (key: CustomFieldReportTab) =>
    `whitespace-nowrap pb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
      active === key
        ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
        : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
    }`;

  return (
    <div className="flex items-center gap-6 overflow-x-auto border-b border-[var(--admin-border)]">
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tabClass(tab.key)}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
