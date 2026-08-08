import type { LucideIcon } from "lucide-react";
import { FileText, MessageSquare } from "lucide-react";
import {
  alertErrorClassName,
  monoClassName,
  panelClassName,
  tableHeadClassName,
} from "../competency/competency-admin-shared";
import {
  ghostButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";

export {
  alertErrorClassName,
  ghostButtonClassName,
  monoClassName,
  outlineButtonClassName,
  panelClassName,
  primaryButtonClassName,
  tableHeadClassName,
};

export const moderationPageTitleClassName =
  "text-[22px] font-bold leading-8 tracking-[-0.02em] text-[var(--admin-on-surface)]";

export const moderationPageEyebrowClassName =
  "text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--admin-primary)]";

export const moderationPageDescClassName =
  "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";

export const moderationToolbarClassName =
  "flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4";

export const moderationTablePanelClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const moderationTableRowClassName =
  "border-b border-[color-mix(in_srgb,var(--admin-border)_65%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface))]";

export const moderationMetricCardClassName =
  "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4";

export const moderationMetricLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const moderationStickyFooterClassName =
  "sticky bottom-0 z-20 mt-8 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_90%,transparent)] px-4 py-4 backdrop-blur-md sm:rounded-xl sm:border sm:shadow-sm";

export const moderationEvidenceCardClassName =
  "relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6";

export const moderationTimelineDotClassName =
  "relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4";

export const moderationChipButtonClassName =
  "inline-flex items-center gap-1.5 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]";

const STATUS_BADGE: Record<string, string> = {
  OPEN:
    "border-[color-mix(in_srgb,var(--admin-outline)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-outline)_12%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
  REVIEWING:
    "border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
  ACTIONED:
    "border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
  REJECTED:
    "border-[color-mix(in_srgb,var(--admin-danger)_55%,var(--admin-border))] bg-transparent text-[var(--admin-danger)]",
  CLOSED:
    "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]",
};

export function moderationStatusBadgeClassName(status: string): string {
  const tone =
    STATUS_BADGE[status] ??
    "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`;
}

export function formatModerationDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

export function formatModerationReason(reasonKey: string | null): string {
  if (!reasonKey) return "Unspecified";
  return reasonKey
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function truncateModerationPreview(text: string, maxLength = 56): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function targetTypeMeta(targetType: string): { label: string; icon: LucideIcon } {
  if (targetType === "comment") {
    return { label: "Comment", icon: MessageSquare };
  }
  return { label: "Post", icon: FileText };
}

export function decisionLabel(decisionKey: string): string {
  switch (decisionKey) {
    case "begin_review":
      return "Moderator review started";
    case "actioned":
      return "Content actioned";
    case "rejected":
      return "Case rejected";
    case "closed":
      return "Case closed";
    default:
      return decisionKey.replace(/_/g, " ");
  }
}

export const appealCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition-[box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] hover:shadow-md sm:p-6";

export const appealCardConflictAccentClassName =
  "pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--admin-warning)]";

export const appealSectionEyebrowClassName =
  "mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";

export const appealEvidenceBlockClassName =
  "rounded-lg border border-[var(--admin-border)] border-l-[3px] border-l-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-warning)_7%,var(--admin-surface-low))] p-4 text-[13px] italic leading-relaxed text-[var(--admin-on-surface-variant)]";

export const appealStatementEyebrowClassName =
  "mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--admin-primary)]";

export const appealConflictBannerClassName =
  "flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-3 text-[13px] font-medium text-[var(--admin-warning)]";

export function formatOriginalDecisionSummary(item: {
  status: string;
  decisions?: Array<{ decisionKey: string }>;
}): string {
  const decisions = item.decisions ?? [];
  const terminal = [...decisions]
    .reverse()
    .find((entry) => ["actioned", "rejected", "closed"].includes(entry.decisionKey));
  if (terminal) {
    return decisionLabel(terminal.decisionKey);
  }
  return `Case status: ${item.status}`;
}

export function formatCaseRef(caseId: string): string {
  return `#${caseId.slice(0, 8).toUpperCase()}`;
}
