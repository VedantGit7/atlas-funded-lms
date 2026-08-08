import {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  selectClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

export {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  selectClassName,
  statusBannerClassName,
};

export const infoBannerClassName =
  "flex items-start gap-3 rounded-lg border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_28%,var(--admin-surface))] px-4 py-3";

export const columnLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const actionBadgeClassName =
  "inline-flex max-w-full rounded-md bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface)]";

export const detailButtonClassName = (active: boolean) =>
  [
    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
    active
      ? "border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/20 text-[var(--admin-primary)]"
      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]/40 hover:text-[var(--admin-primary)]",
  ].join(" ");

export const metadataPreClassName =
  "overflow-x-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 font-mono text-xs leading-relaxed text-[var(--admin-on-surface)]";

export const detailLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const detailValueClassName = "mt-1 text-sm text-[var(--admin-on-surface)]";

export function humanizeAuditAction(action: string): string {
  return action
    .split(".")
    .map((segment) =>
      segment
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .join(" · ");
}

export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatActorLabel(entry: {
  actorMembershipId: string | null;
  platformPrincipalId: string | null;
}): string {
  if (entry.actorMembershipId) {
    return `Member ${entry.actorMembershipId.slice(0, 8)}`;
  }
  if (entry.platformPrincipalId) {
    return `Platform ${entry.platformPrincipalId.slice(0, 8)}`;
  }
  return "System";
}

export function matchesAuditSearch(
  entry: {
    action: string;
    targetType: string;
    targetId: string | null;
    requestId: string;
    reason: string | null;
  },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    entry.action,
    humanizeAuditAction(entry.action),
    entry.targetType,
    entry.targetId ?? "",
    entry.requestId,
    entry.reason ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}
