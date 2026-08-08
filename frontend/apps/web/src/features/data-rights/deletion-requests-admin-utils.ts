import type { DeletionRequestItem } from "./api";

export type DeletionDisplayStatus = DeletionRequestItem["status"];

export const DELETION_STATUS_LABELS: Record<DeletionDisplayStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Processing",
  SUCCEEDED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const DELETIONS_PAGE_SIZE = 10;

export function deletionStatusBadgeClassName(status: DeletionDisplayStatus): string {
  switch (status) {
    case "QUEUED":
      return "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
    case "RUNNING":
      return "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
    case "SUCCEEDED":
      return "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
    case "FAILED":
      return "border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
    case "CANCELLED":
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

export function formatTargetType(targetType: string): string {
  if (targetType === "membership") return "Membership";
  return targetType.replaceAll("_", " ");
}

export function formatShortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function formatRequestedBy(membershipId: string | null): string {
  if (!membershipId) return "—";
  return formatShortId(membershipId);
}

export function formatGracePeriod(request: DeletionRequestItem): string {
  if (request.status === "SUCCEEDED" || request.status === "CANCELLED") return "—";
  if (request.status === "RUNNING") return "In progress";
  if (!request.scheduledAt) return "—";
  const scheduled = new Date(request.scheduledAt);
  if (scheduled.getTime() <= Date.now()) return "Ready to process";
  const diffMs = scheduled.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays <= 1) return "Executes within 24 hours";
  return `Executes in ${diffDays} days`;
}

export function filterDeletionRequests(
  requests: DeletionRequestItem[],
  query: string,
): DeletionRequestItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return requests;
  return requests.filter((request) => {
    const haystack = [
      request.id,
      request.targetId,
      request.targetType,
      request.status,
      request.reason ?? "",
      request.requestedByMembershipId ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function hasActiveDeletions(requests: DeletionRequestItem[]): boolean {
  return requests.some((request) => request.status === "RUNNING");
}

export function paginateRequests<T>(items: T[], page: number, pageSize = DELETIONS_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalDeletionPages(count: number, pageSize = DELETIONS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function canProcessRequest(request: DeletionRequestItem): boolean {
  return request.status === "QUEUED";
}

export function isMutedRequest(request: DeletionRequestItem): boolean {
  return request.status === "SUCCEEDED" || request.status === "CANCELLED";
}
