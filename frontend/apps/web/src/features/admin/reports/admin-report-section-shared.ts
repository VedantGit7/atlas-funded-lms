"use client";

import type { AdminReportSlug } from "../reports/admin-reports-catalog";

export const REPORT_MANAGE_LINKS: Partial<Record<AdminReportSlug, { href: string; label: string }>> = {
  batches: { href: "/admin/batches", label: "Manage batches" },
  polls: { href: "/admin/polls", label: "Manage polls" },
  "live-class-attendance": { href: "/admin/live-sessions", label: "Manage live sessions" },
  "custom-field": { href: "/admin/custom-fields", label: "Manage custom fields" },
  "active-devices": { href: "/admin/devices", label: "Manage device sessions" },
  "resource-usage": { href: "/admin/usagedashboard", label: "Open Usage Insights" },
};

export const SCHEDULE_CADENCE_OPTIONS = [
  { value: "0 * * * *", label: "Hourly" },
  { value: "0 8 * * *", label: "Daily at 08:00 UTC" },
  { value: "0 8 * * 1", label: "Weekly on Monday 08:00 UTC" },
] as const;
