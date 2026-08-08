"use client";

import Link from "next/link";

export type ActiveDevicesTab = "overview" | "alerts" | "policies" | "exports";

export function ActiveDevicesReportTabs({ active }: { active: ActiveDevicesTab }) {
  const tabClass = (key: ActiveDevicesTab) =>
    `pb-3 text-sm font-semibold transition-colors whitespace-nowrap ${
      active === key
        ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
        : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
    }`;

  return (
    <div className="flex items-center gap-8 overflow-x-auto border-b border-[var(--admin-border)]">
      <Link href="/admin/reports/active-devices" className={tabClass("overview")}>
        Overview
      </Link>
      <Link href="/admin/reports/active-devices/alerts" className={tabClass("alerts")}>
        Alerts
      </Link>
      <Link href="/admin/reports/active-devices/policies" className={tabClass("policies")}>
        Policies
      </Link>
      <Link href="/admin/reports/active-devices/exports" className={tabClass("exports")}>
        Exports
      </Link>
    </div>
  );
}
