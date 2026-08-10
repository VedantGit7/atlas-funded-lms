"use client";

import Link from "next/link";

const TABS = [
  { href: "/admin/reports/super-live-insights", label: "Sessions", id: "sessions" },
  { href: "/admin/reports/super-live-insights/trends", label: "Trends", id: "trends" },
  { href: "/admin/reports/super-live-insights/compare", label: "Compare", id: "compare" },
  { href: "/admin/reports/super-live-insights/outliers", label: "Outliers", id: "outliers" },
  { href: "/admin/reports/super-live-insights/exports", label: "Exports", id: "exports" },
] as const;

export type SuperLiveInsightsTabId = (typeof TABS)[number]["id"];

export function SuperLiveInsightsModuleTabs({ active }: { active: SuperLiveInsightsTabId }) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-[var(--admin-border)]"
      role="tablist"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={[
              "shrink-0 px-5 py-3 text-sm transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] font-semibold text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
