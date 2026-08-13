/** Shared class names for the learner notifications inbox. Token-only; no raw hex. */

export const learnerNotificationsPageClassName =
  "mx-auto flex w-full max-w-[800px] flex-col gap-6 pb-8 font-[family-name:var(--font-jakarta),system-ui,sans-serif] md:gap-8";

export const learnerNotificationsHeaderClassName =
  "flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-end md:justify-between";

export const learnerNotificationsTitleClassName =
  "font-ceremonial text-4xl font-medium leading-[1.2] tracking-tight text-[var(--brand-primary)] md:text-5xl";

export const learnerNotificationsDescriptionClassName =
  "mt-1 max-w-[65ch] text-[15px] leading-relaxed text-[var(--muted-foreground)]";

export const learnerNotificationsSettingsLinkClassName =
  "inline-flex min-h-11 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[var(--brand-primary)] transition-colors duration-150 ease-out hover:text-[var(--brand-header)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";

export const learnerNotificationsToolbarClassName =
  "sticky top-16 z-20 -mx-1 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--background)] px-1 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--background)_88%,transparent)] sm:flex-row sm:items-center sm:justify-between";

export const learnerNotificationsSegmentClassName =
  "inline-flex rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-0.5";

export const learnerNotificationsSegmentButtonClassName =
  "min-h-11 min-w-[4.5rem] rounded-[calc(var(--radius)-2px)] px-4 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:scale-[0.98]";

export const learnerNotificationsSegmentActiveClassName =
  "bg-[var(--brand-primary)] text-[var(--primary-foreground)]";

export const learnerNotificationsSegmentInactiveClassName =
  "bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]";

export const learnerNotificationsSearchWrapClassName = "relative w-full sm:w-[280px]";

export const learnerNotificationsSearchFieldClassName =
  "min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] py-2 pl-10 pr-9 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-[var(--ring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";

export const learnerNotificationsClearSearchClassName =
  "absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";

export const learnerNotificationsCaptionClassName =
  "text-[13px] leading-[18px] text-[var(--muted-foreground)]";

export const learnerNotificationsGroupStickyClassName =
  "sticky top-[7.25rem] z-10 -mx-1 bg-[var(--background)] px-1 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--background)_90%,transparent)]";

export const learnerNotificationsGroupHeadingClassName =
  "text-[13px] font-semibold leading-[18px] text-[var(--muted-foreground)]";

export const learnerNotificationsCardClassName =
  "group relative flex w-full min-h-11 items-start gap-3 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:scale-[0.99]";

export const learnerNotificationsCardReadClassName = "opacity-90";

export const learnerNotificationsRailClassName = "absolute inset-y-0 left-0 w-[3px]";

export const learnerNotificationsRailWarningClassName = "bg-[var(--warning)]";

export const learnerNotificationsRailDangerClassName = "bg-[var(--destructive)]";

export const learnerNotificationsUnreadDotClassName =
  "mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]";

export const learnerNotificationsUnreadSpacerClassName = "mt-2 h-2 w-2 shrink-0";

export const learnerNotificationsIconShellClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--brand-primary)]";

export const learnerNotificationsIconAlertShellClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--muted))] text-[var(--warning)]";

export const learnerNotificationsIconDangerShellClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--destructive)_14%,var(--muted))] text-[var(--destructive)]";

export const learnerNotificationsTitleUnreadClassName =
  "text-[15px] font-semibold leading-6 text-[var(--foreground)] line-clamp-2 text-pretty";

export const learnerNotificationsTitleReadClassName =
  "text-[15px] font-medium leading-6 text-[var(--muted-foreground)] line-clamp-2 text-pretty";

export const learnerNotificationsBodyClassName =
  "mt-0.5 text-sm leading-relaxed text-[var(--muted-foreground)] line-clamp-2 text-pretty";

export const learnerNotificationsMetaClassName =
  "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-[var(--muted-foreground)]";

export const learnerNotificationsCategoryPillClassName =
  "inline-flex rounded-full bg-[var(--muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--foreground)]";

export const learnerNotificationsChevronClassName =
  "mt-1 hidden shrink-0 text-[var(--muted-foreground)] transition-colors duration-150 group-hover:text-[var(--brand-primary)] md:block";

export const learnerNotificationsLoadMoreClassName =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-transparent px-4 py-2 text-xs font-medium text-[var(--brand-primary)] transition-[border-color,background-color,transform] duration-150 ease-out hover:border-[var(--border)] hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:scale-[0.98] disabled:opacity-60";

export const learnerNotificationsErrorCardClassName =
  "rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] px-4 py-3 text-sm text-[var(--destructive)]";

export const learnerNotificationsEmptyShellClassName =
  "flex flex-col items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center";

export const learnerNotificationsCaughtUpClassName =
  "text-center text-[13px] text-[var(--muted-foreground)]";
