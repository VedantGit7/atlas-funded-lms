import { cardClassName } from "../../../app/admin/branding/_components/branding-admin-shared";

export { cardClassName };

export const infoBannerClassName =
  "mb-6 flex items-start gap-3 rounded-xl border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_40%,var(--admin-surface))] px-4 py-4 text-[var(--admin-on-primary-container)]";

export const groupHeaderClassName =
  "flex items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/80 px-4 py-3";

export const groupTitleClassName =
  "text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const rowGridClassName =
  "grid gap-4 px-4 py-4 motion-safe:transition-colors motion-safe:duration-200 hover:bg-[var(--admin-surface-low)]/60 md:grid-cols-12 md:items-center";

export const entitlementKeyClassName = (active: boolean) =>
  [
    "block font-mono text-[13px] font-medium",
    active ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]",
  ].join(" ");

export const entitlementDescriptionClassName =
  "mt-0.5 text-xs text-[var(--admin-on-surface-variant)]";

export const guidanceClassName =
  "text-sm italic text-[var(--admin-on-surface-variant)]/80 md:text-right";

export const expiryClassName = (urgent: boolean) =>
  [
    "font-mono text-xs",
    urgent ? "font-semibold text-[var(--admin-warning)]" : "text-[var(--admin-on-surface-variant)]",
  ].join(" ");

export const statusSummaryClassName =
  "inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-1.5";

export const statusDotClassName = (active: boolean) =>
  [
    "h-2 w-2 rounded-full",
    active ? "bg-[var(--admin-success)]" : "bg-[var(--admin-on-surface-variant)]/40",
  ].join(" ");

export function activeStatusPillClassName(active: boolean): string {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide";

  if (active) {
    return `${base} bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`;
  }

  return `${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}

export const inactiveBannerClassName =
  "flex items-start gap-2 rounded-lg border-l-4 border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-2 text-sm text-[var(--admin-on-surface)]";

export const footerNoteClassName =
  "py-8 text-center text-xs text-[var(--admin-on-surface-variant)]";
