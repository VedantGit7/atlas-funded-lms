"use client";

import Link from "next/link";
import { resourceUsageExportsApi } from "./admin-resource-usage-exports-api";
import { INSIGHT_EXPORT_COLUMNS } from "./insight-report-exports-kit";
import { InsightReportExportsPage } from "./InsightReportExportsPage";
import { ResourceUsageNewExportModal } from "./ResourceUsageNewExportModal";

const MODULE_LINKS: Array<{ label: string; href: string; current?: boolean }> = [
  { label: "Overview", href: "/admin/reports/resource-usage" },
  { label: "History", href: "/admin/reports/resource-usage/history" },
  { label: "Storage", href: "/admin/reports/resource-usage/storage" },
  { label: "Dormant", href: "/admin/reports/resource-usage/dormant" },
  { label: "Inactive", href: "/admin/reports/resource-usage/inactive-learners" },
  { label: "Exports", href: "/admin/reports/resource-usage/exports", current: true },
];

function ModuleLinks() {
  return (
    <nav
      aria-label="Resource usage sections"
      className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--admin-on-surface-variant)]"
    >
      {MODULE_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          aria-current={link.current ? "page" : undefined}
          className={
            link.current
              ? "font-semibold text-[var(--admin-primary-strong)]"
              : "hover:text-[var(--admin-primary)]"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

const COLUMNS = [
  INSIGHT_EXPORT_COLUMNS.fileWithDataset,
  INSIGHT_EXPORT_COLUMNS.scope,
  INSIGHT_EXPORT_COLUMNS.rows,
  INSIGHT_EXPORT_COLUMNS.size,
];

/** The Exports tab of the Resource usage report, under that page's header. */
export function AdminResourceUsageExportsPanel() {
  return (
    <InsightReportExportsPage
      api={resourceUsageExportsApi}
      layout="panel"
      description="Download usage data or schedule recurring delivery."
      tabs={<ModuleLinks />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download usage data."
      pageSize={10}
      historyNote={(payload) => payload.capabilities.note}
      rerunExpired
      renderNewExport={(slot) => (
        <ResourceUsageNewExportModal
          open={slot.open}
          capabilities={slot.payload.capabilities}
          estimates={slot.payload.estimates}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
