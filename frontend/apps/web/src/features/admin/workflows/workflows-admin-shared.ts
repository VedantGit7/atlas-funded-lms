import {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../../competency/competency-admin-shared";
import { notificationsSearchFieldClassName } from "../../notifications/notifications-admin-shared";

export const workflowWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm lg:flex-row";

export const workflowListPanelClassName =
  "flex min-h-[320px] w-full flex-col border-b border-[var(--admin-border)] lg:min-h-0 lg:w-[min(100%,380px)] lg:max-w-[30%] lg:shrink-0 lg:border-b-0 lg:border-r";

export const workflowListHeaderClassName =
  "sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_82%,transparent)] p-4 backdrop-blur-md sm:p-5";

export const workflowListScrollClassName = "flex-1 space-y-2 overflow-y-auto p-3 sm:p-4";

export const workflowListItemClassName =
  "rounded-xl border border-transparent p-4 motion-safe:transition-[box-shadow,background-color,border-color,opacity] hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const workflowListItemSelectedClassName =
  "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] ring-2 ring-[var(--admin-primary)]/20";

export const workflowListFooterClassName =
  "mt-auto border-t border-[var(--admin-border)] p-4 sm:p-5";

export const workflowEditorPanelClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]";

export const workflowEditorHeaderClassName =
  "grid gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-5 sm:grid-cols-12 sm:px-8 sm:py-6";

export const workflowCanvasWrapperClassName =
  "overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const workflowCanvasHeaderClassName =
  "flex items-center justify-between border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_30%,var(--admin-surface))] px-5 py-3";

export const workflowCanvasClassName =
  "relative flex min-h-[280px] items-center justify-center overflow-x-auto px-6 py-10 sm:min-h-[320px] sm:px-12 [background-image:radial-gradient(color-mix(in_srgb,var(--admin-border)_80%,transparent)_0.5px,transparent_0.5px)] [background-size:16px_16px]";

export const workflowSectionHeadingClassName =
  "border-l-4 pl-4 text-base font-semibold text-[var(--admin-on-surface)]";

export const workflowLogicPanelClassName =
  "space-y-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-container,var(--admin-surface-high))] p-5";

export const workflowFooterClassName =
  "sticky bottom-0 mt-auto flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5";

export const workflowSearchFieldClassName = notificationsSearchFieldClassName;

export const workflowKeyInputClassName = `${fieldClassName} ${monoClassName} text-[var(--admin-primary)]`;

export const workflowJsonTextareaClassName =
  "min-h-48 w-full resize-none border-none bg-transparent font-mono text-[13px] leading-relaxed text-[var(--admin-on-surface)] focus:outline-none focus:ring-0";

export const workflowJsonPanelClassName =
  "rounded-b-xl border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5";

export const workflowTargetChipClassName =
  "rounded-md bg-[var(--admin-surface-high)] px-2 py-1 text-[11px] font-medium text-[var(--admin-on-surface-variant)]";

export const workflowNewDefinitionButtonClassName =
  "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--admin-border)] py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] motion-safe:transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]";

export function workflowStatusBadgeClassName(status: "ACTIVE" | "DRAFT" | "ARCHIVED"): string {
  const base =
    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide";
  switch (status) {
    case "ACTIVE":
      return `${base} border-[color-mix(in_srgb,var(--admin-success)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]`;
    case "DRAFT":
      return `${base} border-[color-mix(in_srgb,var(--admin-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]`;
    case "ARCHIVED":
      return `${base} border-[color-mix(in_srgb,var(--admin-on-surface-variant)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_10%,transparent)] text-[var(--admin-on-surface-variant)]`;
  }
}

export {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
};
