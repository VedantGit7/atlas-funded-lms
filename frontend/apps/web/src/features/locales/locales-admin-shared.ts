import { fieldClassName } from "../../app/admin/branding/_components/branding-admin-shared";

export const localesWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const localesRailClassName =
  "flex w-16 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface-high)]";

export const localesRailButtonClassName =
  "relative flex h-16 w-full items-center justify-center text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const localesRailButtonActiveClassName =
  "bg-[var(--admin-surface-container-highest,var(--admin-surface-high))] text-[var(--admin-primary)] before:absolute before:left-0 before:top-1/2 before:h-12 before:w-1 before:-translate-y-1/2 before:bg-[var(--admin-primary)] before:content-['']";

export const localesMainClassName =
  "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--admin-surface-low)]";

export const localesPanelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-6";

export const localesLocaleListItemClassName =
  "flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-left text-sm motion-safe:transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const localesLocaleListItemActiveClassName =
  "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary-container,var(--admin-primary))_12%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]";

export const localesSearchInputClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 pl-9 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const localesTableShellClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const localesTableHeadClassName =
  "bg-[var(--admin-surface-high)] text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const localesTableRowClassName =
  "border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)] motion-safe:transition-colors";

export const localesMonoKeyClassName =
  "font-mono text-[12px] font-semibold text-[var(--admin-on-surface)]";

export const localesEditorPanelClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5";

export const localesAlertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const localesAlertSuccessClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-success)]";

export const localesTextareaClassName = `${fieldClassName} min-h-28 resize-y font-mono text-[13px]`;

export const localesSelectTriggerClassName =
  "w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] focus-visible:ring-[var(--admin-primary)]/30";

export const localesInputClassName =
  "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:ring-[var(--admin-primary)]/30";

export const localesPrimaryButtonClassName =
  "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:opacity-90";

export { fieldClassName };
