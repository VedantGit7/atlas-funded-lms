"use client";

import Link from "next/link";

export type BatchesReportTab = "batches" | "compare" | "exports";

const TABS: Array<{ key: BatchesReportTab; label: string; href: string }> = [
  { key: "batches", label: "Batches", href: "/admin/reports/batches" },
  { key: "compare", label: "Compare", href: "/admin/reports/batches/compare" },
  { key: "exports", label: "Exports", href: "/admin/reports/batches/exports" },
];

export function BatchesReportTabs({ active }: { active: BatchesReportTab }) {
  return (
    <div className="border-b border-[var(--admin-border)]">
      <div className="flex gap-1" role="tablist" aria-label="Batches module">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active === tab.key}
            className={[
              "h-10 px-4 text-xs font-semibold tracking-[0.06em] uppercase transition-colors",
              active === tab.key
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
