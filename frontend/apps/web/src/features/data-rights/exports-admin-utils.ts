import type { ExportJobItem } from "./api";

export type ExportDisplayStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export const EXPORT_STATUS_LABELS: Record<ExportDisplayStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function resolveExportDisplayStatus(job: ExportJobItem): ExportDisplayStatus {
  if (
    job.status === "SUCCEEDED" &&
    job.expiresAt &&
    new Date(job.expiresAt).getTime() <= Date.now()
  ) {
    return "EXPIRED";
  }
  if (job.status === "QUEUED" || job.status === "RUNNING" || job.status === "SUCCEEDED") {
    return job.status;
  }
  if (job.status === "FAILED") return "FAILED";
  if (job.status === "CANCELLED") return "CANCELLED";
  return "FAILED";
}

export function exportStatusBadgeClassName(status: ExportDisplayStatus): string {
  switch (status) {
    case "RUNNING":
      return "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]";
    case "SUCCEEDED":
      return "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
    case "QUEUED":
      return "border-[color-mix(in_srgb,var(--admin-primary)_15%,var(--admin-border))] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
    case "FAILED":
      return "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
    case "CANCELLED":
    case "EXPIRED":
      return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
    default:
      return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatExpiresLabel(job: ExportJobItem, displayStatus: ExportDisplayStatus): string {
  if (displayStatus === "EXPIRED") return "Expired";
  if (!job.expiresAt) return "—";
  const expires = new Date(job.expiresAt);
  if (expires.getTime() <= Date.now()) return "Expired";
  const diffMs = expires.getTime() - Date.now();
  const diffHours = Math.round(diffMs / 3_600_000);
  if (diffHours < 24) {
    return diffHours <= 1 ? "In under 1 hour" : `In ${diffHours} hours`;
  }
  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? "In 1 day" : `In ${diffDays} days`;
}

export function formatRequestedBy(membershipId: string): string {
  if (!membershipId) return "—";
  return membershipId.length > 12 ? `${membershipId.slice(0, 8)}…` : membershipId;
}

export function canDownloadExport(displayStatus: ExportDisplayStatus): boolean {
  return displayStatus === "SUCCEEDED";
}

export const EXPORTS_PAGE_SIZE = 10;

export function paginateJobs<T>(items: T[], page: number, pageSize = EXPORTS_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalExportPages(count: number, pageSize = EXPORTS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function hasPendingExports(jobs: ExportJobItem[]): boolean {
  return jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
}
