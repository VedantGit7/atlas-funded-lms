import {
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";

export const managePageTitleClassName = generalSettingsPageTitleClassName;
export const managePageDescClassName = generalSettingsPageDescClassName;

export const manageTableCardClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const manageTableHeadClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]";

export const manageTableThClassName =
  "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const manageTableTdClassName = "px-4 py-3 text-sm text-[var(--admin-on-surface)]";

export const manageSearchInputClassName =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const managePrimaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-4 py-2.5 text-sm font-bold text-[var(--admin-surface)] transition-opacity hover:opacity-90 motion-safe:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const manageSecondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] motion-safe:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const manageDangerButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 motion-safe:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-50";

export const manageMenuButtonClassName =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]";

export const manageDropdownPanelClassName = [
  "absolute right-0 z-30 mt-1.5 min-w-[11rem] bg-[var(--admin-surface)] shadow-lg",
  dropdownPanelSurfaceClassName,
].join(" ");

export const manageDropdownItemClassName =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] transition-colors duration-150 hover:bg-[var(--admin-surface-high)] focus-visible:bg-[var(--admin-surface-high)] focus-visible:outline-none";

export const manageStickyFooterClassName =
  "admin-glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-border)] px-4 py-4 md:px-8 lg:left-[280px]";

export function manageStatusChipClassName(
  tone: "success" | "danger" | "primary" | "neutral",
): string {
  const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold";
  if (tone === "success") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]`;
  }
  if (tone === "danger") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]`;
  }
  if (tone === "primary") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] text-[var(--admin-primary)]`;
  }
  return `${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}
