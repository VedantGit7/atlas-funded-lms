import {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  primaryButtonClassName,
  selectClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { monoClassName } from "../competency/competency-admin-shared";

export const extensionsWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const extensionsRailClassName =
  "flex w-16 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface-high)] py-4";

export const extensionsRailButtonClassName =
  "relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-container-highest,var(--admin-surface-low))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:scale-95";

export const extensionsRailButtonActiveClassName =
  "bg-[var(--admin-surface-container-highest,var(--admin-surface-high))] text-[var(--admin-primary)] before:absolute before:left-0 before:top-1/2 before:h-8 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-[var(--admin-primary)] before:content-['']";

export const extensionsMainClassName =
  "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--admin-surface-low)]";

export const extensionsTopBarClassName =
  "flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-6";

export const extensionsContentClassName =
  "flex-1 overflow-y-auto p-4 sm:p-6";

export const extensionsGridClassName =
  "grid grid-cols-1 gap-6 xl:grid-cols-12";

export const extensionsPrimaryColumnClassName = "flex flex-col gap-6 xl:col-span-8";

export const extensionsSideColumnClassName = "xl:col-span-4";

export const extensionsStickyPanelClassName = "xl:sticky xl:top-4 space-y-6";

export const extensionsSectionClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const extensionsSectionMutedClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-variant,var(--admin-surface-high))]";

export const extensionsSectionHeaderClassName =
  "flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-5";

export const extensionsSectionHeaderSoftClassName =
  "flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:px-5";

export const extensionsTableHeadClassName =
  "bg-[var(--admin-surface-low)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const extensionsTableRowClassName =
  "border-b border-[var(--admin-border)] motion-safe:transition-colors hover:bg-[var(--admin-surface-low)]";

export const extensionsMonoKeyClassName = `${monoClassName} text-[12px] font-semibold text-[var(--admin-primary)]`;

export const extensionsSearchInputClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const extensionsJsonEditorClassName =
  "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-lowest,var(--admin-surface-low))] motion-safe:transition-[border-color,box-shadow] focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/20";

export const extensionsJsonEditorErrorClassName =
  "border-[color-mix(in_srgb,var(--admin-danger)_50%,var(--admin-border))] focus-within:border-[var(--admin-danger)] focus-within:ring-[var(--admin-danger)]/20";

export const extensionsJsonTextareaClassName =
  "min-h-[12rem] w-full resize-y border-none bg-transparent p-4 font-mono text-[12px] leading-5 text-[var(--admin-on-surface)] outline-none";

export const extensionsStatusToggleGroupClassName =
  "grid grid-cols-2 gap-2";

export const extensionsStatusToggleActiveClassName =
  "flex items-center justify-center gap-2 rounded-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-3 py-2.5 text-sm font-semibold text-[var(--admin-primary)] motion-safe:transition-colors";

export const extensionsStatusToggleInactiveClassName =
  "flex items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)] motion-safe:transition-colors";

export const extensionsAlertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const extensionsAlertSuccessClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-success)]";

export const extensionsHealthCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-container,var(--admin-surface-high))] p-5";

export const extensionsNavTabClassName =
  "text-sm font-semibold text-[var(--admin-on-surface-variant)] motion-safe:transition-colors hover:text-[var(--admin-primary)]";

export const extensionsNavTabActiveClassName = "text-[var(--admin-primary)]";

export {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  primaryButtonClassName,
  selectClassName,
};
