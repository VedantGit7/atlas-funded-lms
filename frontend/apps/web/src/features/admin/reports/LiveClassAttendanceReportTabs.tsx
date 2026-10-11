"use client";

import Link from "next/link";

export type LiveClassAttendanceReportTab = "sessions" | "learners" | "series" | "exports";

const TABS: Array<{ key: LiveClassAttendanceReportTab; label: string; href: string }> = [
  { key: "sessions", label: "Sessions", href: "/admin/reports/live-class-attendance" },
  { key: "learners", label: "Learners", href: "/admin/reports/live-class-attendance/learners" },
  { key: "series", label: "Series", href: "/admin/reports/live-class-attendance/series" },
  { key: "exports", label: "Exports", href: "/admin/reports/live-class-attendance/exports" },
];

export function LiveClassAttendanceReportTabs({
  active,
}: {
  active: LiveClassAttendanceReportTab;
}) {
  return (
    <div className="flex gap-8 border-b border-[var(--admin-border)]" role="tablist">
      {TABS.map((tab) => {
        const selected = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={[
              "pb-3 text-sm transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary-strong)] font-semibold text-[var(--admin-primary-strong)]"
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
