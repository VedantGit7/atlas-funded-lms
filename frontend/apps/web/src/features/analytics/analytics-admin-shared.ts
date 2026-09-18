import {
  applyToolbarButtonClassName,
  chartFill,
  chartGridStroke,
  chartLineStroke,
  toolbarLabelClassName,
  toolbarSegmentClassName,
} from "./analytics-studio-shared";
import {
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";

export const analyticsWorkspaceClassName =
  "flex min-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const analyticsRailClassName =
  "flex w-16 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface-high)] py-4";

export const analyticsRailButtonClassName =
  "relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-container-highest,var(--admin-surface-low))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:scale-95";

export const analyticsRailButtonActiveClassName =
  "bg-[var(--admin-surface-container-highest,var(--admin-surface-high))] text-[var(--admin-primary)] before:absolute before:left-0 before:top-1/2 before:h-8 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-[var(--admin-primary)] before:content-['']";

export const analyticsMainClassName =
  "flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--admin-surface-low)]";

export const analyticsTopBarClassName =
  "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-6";

export const analyticsContentClassName = "flex-1 overflow-y-auto p-4 sm:p-6";

export const analyticsTabNavClassName = "flex border-b border-[var(--admin-border)]";

export const analyticsTabButtonClassName =
  "flex items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]";

export const analyticsTabButtonActiveClassName =
  "border-b-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]";

export const analyticsMetricCardClassName =
  "group relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:transition-colors hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))]";

export const analyticsMetricLabelClassName =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]";

export const analyticsMetricValueClassName =
  "text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]";

export const analyticsChartPanelClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-container,var(--admin-surface-high))] p-5 sm:p-6";

export const analyticsFunnelPanelClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6";

export const analyticsInsightBannerClassName =
  "mt-6 flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4";

export const analyticsTableShellClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const analyticsTableHeadClassName =
  "bg-[var(--admin-surface-low)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const analyticsTableRowClassName =
  "border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)] motion-safe:transition-colors";

export const analyticsAlertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]";

export const analyticsEmptyStateClassName =
  "rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]";

export const analyticsDateRangeShellClassName =
  "flex flex-wrap items-end gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-container,var(--admin-surface-high))] px-3 py-2";

export const analyticsExportButtonClassName =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50";

export {
  applyToolbarButtonClassName,
  chartFill,
  chartGridStroke,
  chartLineStroke,
  toolbarLabelClassName,
  toolbarSegmentClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
};
