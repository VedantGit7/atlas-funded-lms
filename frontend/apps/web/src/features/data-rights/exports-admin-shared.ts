import {
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../competency/competency-admin-shared";

export const exportsWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const exportsMainClassName =
  "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--admin-surface-low)]";

export const exportsContentClassName = "flex-1 overflow-y-auto p-4 sm:p-6";

export const exportsPageHeaderClassName =
  "mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between";

export const exportsTableShellClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const exportsTableToolbarClassName =
  "flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:px-5";

export const exportsTableHeadClassName =
  "bg-[var(--admin-surface-low)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const exportsTableRowClassName =
  "border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[var(--admin-surface-low)]";

export const exportsTableRowMutedClassName =
  "border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_35%,var(--admin-surface))] opacity-70";

export const exportsTableFooterClassName =
  "flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:px-5";

export const exportsInfoCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5";

export const exportsAlertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const exportsEmptyStateClassName =
  "rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]";

export const exportsPollingDotClassName =
  "h-2 w-2 rounded-full bg-[var(--admin-primary)] motion-safe:animate-pulse";

export const exportsErrorCodeClassName = `${monoClassName} rounded bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] text-[var(--admin-danger)]`;

export { fieldClassName, ghostButtonClassName, primaryButtonClassName };
