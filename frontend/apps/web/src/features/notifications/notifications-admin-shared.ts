import {
  fieldClassName,
  ghostButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";
import { iconButtonClassName } from "../gamification/gamification-admin-shared";

export const notificationsPageShellClassName =
  "mx-auto flex w-full max-w-[720px] flex-col gap-8 py-2 sm:py-4";

export const notificationsToolbarClassName =
  "flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 sm:flex-row sm:items-center sm:justify-between";

export const notificationsFilterTabClassName =
  "relative pb-2 text-[13px] font-medium leading-[18px] tracking-[0.01em] transition-colors";

export const notificationsFilterTabActiveClassName =
  "text-[var(--admin-primary)] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[var(--admin-primary)]";

export const notificationsFilterTabInactiveClassName =
  "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]";

export const notificationsGroupHeadingClassName =
  "text-[12px] font-medium uppercase leading-4 tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const notificationsGroupDividerClassName =
  "h-px flex-1 bg-[var(--admin-border)]";

export const notificationsCardClassName =
  "group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] p-4 motion-safe:transition-[background-color,box-shadow,border-color] hover:border-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-border))] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const notificationsCardUnreadStripeClassName =
  "absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)] motion-safe:transition-opacity";

export const notificationsCardDangerStripeClassName =
  "absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-danger)]";

export const notificationsIconShellClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-primary)]";

export const notificationsIconDangerShellClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]";

export const notificationsCardTitleClassName =
  "text-[13px] font-semibold leading-[18px] text-[var(--admin-on-surface)]";

export const notificationsCardBodyClassName =
  "mt-1 text-sm leading-5 text-[var(--admin-on-surface-variant)]";

export const notificationsCardMetaClassName =
  "mt-2 text-[12px] leading-4 text-[color-mix(in_srgb,var(--admin-on-surface-variant)_72%,transparent)]";

export const notificationsUnreadDotClassName =
  "h-2 w-2 shrink-0 rounded-full bg-[var(--admin-primary)] motion-safe:transition-opacity";

export const notificationsCardActionsClassName =
  "flex shrink-0 gap-1 opacity-100 motion-safe:transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100";

export const notificationsSearchFieldClassName = `${fieldClassName} h-9 py-1.5 pl-10 pr-4 text-[13px]`;

export const notificationsEmptyShellClassName =
  "flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-14 text-center";

export {
  fieldClassName,
  ghostButtonClassName,
  iconButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
};
