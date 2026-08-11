export const insightPageClassName = "mx-auto flex w-full max-w-[1440px] flex-col gap-6";

export const insightPageTitleClassName =
  "text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]";

export const insightPageDescClassName =
  "mt-1 text-sm leading-5 text-[var(--admin-on-surface-variant)]";

export const insightGhostButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm text-[var(--admin-on-surface-variant)] outline-none transition-[background-color,border-color,color,transform] duration-200 hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const insightPrimaryButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] outline-none transition-[background-color,transform] duration-200 hover:bg-[var(--admin-primary-strong)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const insightPanelClassName =
  "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const insightPanelHeaderClassName =
  "flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4";

export const insightPanelTitleClassName =
  "truncate text-base font-semibold text-[var(--admin-on-surface)]";

export const insightKpiCardClassName =
  "flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const insightKpiLabelClassName =
  "text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";

export const insightKpiValueClassName =
  "font-data text-[28px] font-medium leading-9 tracking-tight text-[var(--admin-on-surface)]";

export const insightTableHeadClassName =
  "sticky top-0 z-[1] border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";

export const insightTableRowClassName =
  "h-11 border-b border-[var(--admin-border)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--admin-surface-high)]";

export const insightShimmerClassName = [
  "relative overflow-hidden rounded bg-[var(--admin-surface-high)]",
  "after:absolute after:inset-0 after:-translate-x-full",
  "motion-safe:after:animate-[shimmer_1.8s_infinite]",
  "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
].join(" ");

export const insightSelectTriggerClassName =
  "h-11 min-w-[11.5rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";

export const insightSelectContentClassName =
  "admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";

export const DASHBOARD_PRIMARY_WIDGET_IDS = [
  "revenue",
  "products",
  "learners",
  "current-mau",
  "active-users-30d",
  "enrollments",
  "monthly-revenue",
  "monthly-enrollments",
  "top-products",
  "payment-orders",
  "failed-payments",
] as const;

export const INSIGHT_RANGE_OPTIONS = [
  { value: "12m", label: "Last 12 months" },
  { value: "30d", label: "Last 30 days" },
  { value: "ytd", label: "Year to date" },
] as const;

export const insightSegmentTrackClassName =
  "flex h-10 items-center rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-1";

export const insightSegmentButtonClassName =
  "inline-flex h-full items-center gap-1.5 rounded px-3 text-sm font-medium text-[var(--admin-on-surface-variant)] outline-none transition-colors duration-150 hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const insightSegmentButtonActiveClassName =
  "inline-flex h-full items-center gap-1.5 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm font-medium text-[var(--admin-primary)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const insightGroupPanelClassName =
  "rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5";

export const insightGroupTitleClassName =
  "mb-4 border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]";

export const insightBreadcrumbClassName =
  "mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]";
