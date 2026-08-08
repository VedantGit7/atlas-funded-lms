import {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../competency/competency-admin-shared";
import { iconButtonClassName } from "../gamification/gamification-admin-shared";
import { notificationsSearchFieldClassName } from "../notifications/notifications-admin-shared";

export const automationWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm lg:flex-row";

export const automationListPanelClassName =
  "flex min-h-[280px] w-full flex-col border-b border-[var(--admin-border)] lg:min-h-0 lg:w-[min(100%,400px)] lg:max-w-[400px] lg:shrink-0 lg:border-b-0 lg:border-r";

export const automationListHeaderClassName =
  "flex items-center justify-between gap-3 p-4 sm:p-5";

export const automationListScrollClassName = "flex-1 overflow-y-auto px-4 pb-5 sm:px-5";

export const automationListItemClassName =
  "rounded-xl border border-[var(--admin-border)] p-4 motion-safe:transition-[box-shadow,background-color,border-color] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const automationListItemSelectedClassName =
  "border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]";

export const automationEditorPanelClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]";

export const automationEditorInnerClassName =
  "mx-auto w-full max-w-[800px] space-y-8 p-4 sm:p-6 lg:p-8";

export const automationStepCardClassName =
  "relative rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm";

export const automationStepConnectorClassName =
  "relative pb-12 after:absolute after:bottom-0 after:left-6 after:top-full after:h-12 after:w-0.5 after:bg-[var(--admin-primary)] after:content-['']";

export const automationStepIconPrimaryClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";

export const automationStepIconWarningClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]";

export const automationStepIconSuccessClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";

export const automationActionToggleGroupClassName =
  "grid grid-cols-2 gap-3 rounded-xl bg-[var(--admin-surface-container,var(--admin-surface-high))] p-1";

export const automationActionToggleActiveClassName =
  "rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-primary)] shadow-sm motion-safe:transition-colors";

export const automationActionToggleInactiveClassName =
  "rounded-lg px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] motion-safe:transition-colors";

export const automationFooterClassName =
  "flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between";

export const automationHistoryTableClassName =
  "w-full border-collapse overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-left text-sm";

export const automationHistoryHeadClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[13px] font-semibold text-[var(--admin-on-surface-variant)]";

export const automationRuleCodeClassName = `${monoClassName} text-[13px] font-bold text-[var(--admin-primary)]`;

export const automationSearchFieldClassName = notificationsSearchFieldClassName;

export const automationJsonPreviewClassName =
  "overflow-x-auto rounded-lg bg-[var(--admin-surface-high)] p-4 font-mono text-[12px] leading-5 text-[var(--admin-on-surface)]";

export function automationStatusBadgeClassName(
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED",
): string {
  const base =
    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide";
  switch (status) {
    case "ACTIVE":
      return `${base} bg-[color-mix(in_srgb,var(--admin-success)_14%,transparent)] text-[var(--admin-success)]`;
    case "INACTIVE":
      return `${base} bg-[color-mix(in_srgb,var(--admin-warning)_14%,transparent)] text-[var(--admin-warning)]`;
    case "ARCHIVED":
      return `${base} bg-[color-mix(in_srgb,var(--admin-danger)_14%,transparent)] text-[var(--admin-danger)]`;
  }
}

export function automationRunStatusBadgeClassName(status: string): string {
  const base =
    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide";
  if (status === "SUCCEEDED") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-success)_14%,transparent)] text-[var(--admin-success)]`;
  }
  if (status === "FAILED") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-danger)_14%,transparent)] text-[var(--admin-danger)]`;
  }
  return `${base} bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]`;
}

export function automationStatusLabel(status: "ACTIVE" | "INACTIVE" | "ARCHIVED"): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "ARCHIVED":
      return "Archived";
  }
}

export {
  fieldClassName,
  ghostButtonClassName,
  iconButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
};
