"use client";

import Link from "next/link";

export type PollsReportTab = "polls" | "live" | "compare" | "exports";

const TABS: Array<{ key: PollsReportTab; label: string; href: string }> = [
  { key: "polls", label: "Polls", href: "/admin/reports/polls" },
  { key: "live", label: "Live Sessions", href: "/admin/reports/polls/live-sessions" },
  { key: "compare", label: "Compare", href: "/admin/reports/polls/compare" },
  { key: "exports", label: "Exports", href: "/admin/reports/polls/exports" },
];

export function PollsReportTabs({ active }: { active: PollsReportTab }) {
  return (
    <div className="border-b border-[var(--admin-border)]">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Polls module">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active === tab.key}
            className={[
              "inline-flex h-10 items-center whitespace-nowrap px-6 text-sm font-semibold transition-colors",
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
