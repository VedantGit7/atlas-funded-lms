import {
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../competency/competency-admin-shared";

export const deletionsWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const deletionsMainClassName =
  "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--admin-surface-low)]";

export const deletionsContentClassName = "flex-1 overflow-y-auto p-4 sm:p-6";

export const deletionsPageHeaderClassName =
  "mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between";

export const deletionsTableShellClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const deletionsTableToolbarClassName =
  "flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5";

export const deletionsSearchInputClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 sm:max-w-xs";

export const deletionsTableHeadClassName =
  "bg-[var(--admin-surface-low)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const deletionsTableRowClassName =
  "border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[var(--admin-surface-low)]";

export const deletionsTableRowMutedClassName =
  "border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_35%,var(--admin-surface))] opacity-75";

export const deletionsTableFooterClassName =
  "flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:px-5";

export const deletionsInfoCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5";

export const deletionsAlertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const deletionsEmptyStateClassName =
  "rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]";

export const deletionsPollingDotClassName =
  "h-2 w-2 rounded-full bg-[var(--admin-primary)] motion-safe:animate-pulse";

export const deletionsTargetIdClassName = `${monoClassName} text-[11px] text-[var(--admin-on-surface-variant)]`;

export const deletionsDangerPanelClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))] p-4 text-sm text-[var(--admin-on-surface)]";

export const deletionsOutlineButtonClassName =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-surface-high)] motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const deletionsProcessButtonClassName =
  "inline-flex items-center rounded-lg border border-[var(--admin-danger)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export {
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
};
