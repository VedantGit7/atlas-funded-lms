import {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../competency/competency-admin-shared";
import { iconButtonClassName } from "../gamification/gamification-admin-shared";
import { notificationsSearchFieldClassName } from "./notifications-admin-shared";

export const templateWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const templateListPanelClassName =
  "flex min-h-[280px] flex-col border-b border-[var(--admin-border)] lg:min-h-0 lg:w-[min(100%,380px)] lg:max-w-[380px] lg:border-b-0 lg:border-r";

export const templateListHeaderClassName =
  "flex items-start justify-between gap-3 border-b border-[var(--admin-border)] p-4 sm:p-5";

export const templateListScrollClassName = "custom-scrollbar flex-1 overflow-y-auto";

export const templateListItemClassName =
  "cursor-pointer border-b border-[var(--admin-border)] p-4 motion-safe:transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/30";

export const templateListItemSelectedClassName =
  "border-l-4 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]";

export const templateEditorPanelClassName = "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

export const templateEditorHeaderClassName =
  "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4 sm:px-6";

export const templateSplitPaneClassName =
  "flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row";

export const templateEditorPaneClassName =
  "custom-scrollbar min-h-0 flex-1 overflow-y-auto border-b border-[var(--admin-border)] p-4 sm:p-6 xl:w-1/2 xl:border-b-0 xl:border-r";

export const templatePreviewPaneClassName =
  "custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--admin-surface-low)] p-4 sm:p-6 xl:w-1/2";

export const templateFooterClassName =
  "flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6";

export const templateChipClassName =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-container,var(--admin-surface-low))] px-2.5 py-1 text-[13px] font-medium text-[var(--admin-on-surface)]";

export const templateMonoKeyClassName = `${monoClassName} text-[13px] text-[var(--admin-primary)]`;

export const templateBodyTextareaClassName = `${fieldClassName} min-h-72 resize-none font-mono text-[12px] leading-5`;

export const templatePreviewCardClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const templatePreviewHeaderClassName =
  "space-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4 text-sm";

export const templatePreviewBodyClassName =
  "min-h-[240px] space-y-4 p-5 text-sm leading-6 text-[var(--admin-on-surface)] sm:p-6";

export const templateInfoPanelClassName =
  "mt-6 flex gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-4";

export const templateVariablesTableClassName =
  "w-full border-collapse overflow-hidden rounded-lg border border-[var(--admin-border)] text-left text-sm";

export const templateVariablesHeadClassName =
  "bg-[var(--admin-surface-high)] text-[13px] font-medium text-[var(--admin-on-surface-variant)]";

export const templateSearchFieldClassName = notificationsSearchFieldClassName;

export function templateStatusBadgeClassName(status: "ACTIVE" | "INACTIVE" | "ARCHIVED"): string {
  const base = "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide";
  switch (status) {
    case "ACTIVE":
      return `${base} bg-[color-mix(in_srgb,var(--admin-success)_14%,transparent)] text-[var(--admin-success)]`;
    case "INACTIVE":
      return `${base} bg-[color-mix(in_srgb,var(--admin-warning)_14%,transparent)] text-[var(--admin-warning)]`;
    case "ARCHIVED":
      return `${base} bg-[color-mix(in_srgb,var(--admin-danger)_14%,transparent)] text-[var(--admin-danger)]`;
  }
}

export function templateStatusLabel(status: "ACTIVE" | "INACTIVE" | "ARCHIVED"): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "ARCHIVED":
      return "Archived";
  }
}

export function templateChannelLabel(channel: "in_app" | "email"): string {
  return channel === "email" ? "Email" : "In-app";
}

export {
  fieldClassName,
  ghostButtonClassName,
  iconButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
};
