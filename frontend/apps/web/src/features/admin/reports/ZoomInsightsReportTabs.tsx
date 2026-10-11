"use client";

import Link from "next/link";

export type ZoomInsightsReportTab =
  | "meetings"
  | "participants"
  | "unmatched"
  | "connection"
  | "exports";

const TABS: Array<{ key: ZoomInsightsReportTab; label: string; href: string }> = [
  { key: "meetings", label: "Meetings", href: "/admin/reports/zoom-insights" },
  { key: "participants", label: "Participants", href: "/admin/reports/zoom-insights/participants" },
  { key: "unmatched", label: "Unmatched", href: "/admin/reports/zoom-insights/unmatched" },
  { key: "connection", label: "Connection", href: "/admin/reports/zoom-insights/connection" },
  { key: "exports", label: "Exports", href: "/admin/reports/zoom-insights/exports" },
];

export function ZoomInsightsReportTabs({ active }: { active: ZoomInsightsReportTab }) {
  return (
    <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
      {TABS.map((tab) => {
        const selected = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            className={[
              "px-1 pb-2 text-sm font-semibold transition-colors",
              selected
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
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
