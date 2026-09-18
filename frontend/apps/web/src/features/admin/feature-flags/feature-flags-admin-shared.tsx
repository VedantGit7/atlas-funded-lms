import {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  primaryButtonClassName,
  sectionDescClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

export {
  cardClassName,
  cardHeaderClassName,
  fieldClassName,
  primaryButtonClassName,
  sectionDescClassName,
  statusBannerClassName,
};

export const PAGE_SIZE = 8;

export const infoBannerClassName =
  "mb-6 flex items-start gap-3 rounded-lg border border-[var(--admin-primary)]/20 bg-[color-mix(in_srgb,var(--admin-primary-container)_28%,var(--admin-surface))] px-4 py-3";

export const rowClassName =
  "flex flex-col gap-4 px-6 py-4 motion-safe:transition-colors motion-safe:duration-200 hover:bg-[var(--admin-surface-low)]/80 sm:flex-row sm:items-center sm:gap-6";

export const flagKeyClassName = "font-mono text-[13px] font-bold text-[var(--admin-primary)]";

export const flagTitleClassName = "text-sm font-semibold text-[var(--admin-on-surface)]";

export const flagDescriptionClassName =
  "text-xs leading-relaxed text-[var(--admin-on-surface-variant)]";

export const columnLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export function enabledBadgeClassName(enabled: boolean): string {
  return enabled
    ? "inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]"
    : "inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

export function sourceBadgeClassName(source: "entitlement" | "platform" | "override"): string {
  const base = "inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider";

  if (source === "entitlement") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]`;
  }

  if (source === "override") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] text-[var(--admin-warning)]`;
  }

  return `${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}

export const compactInputClassName =
  "rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)]";

export const saveButtonClassName =
  "rounded bg-[var(--admin-primary-container)] px-2 py-1 text-[11px] font-bold uppercase text-[var(--admin-on-primary-container)] transition-transform motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

export const paginationButtonClassName = (active: boolean) =>
  [
    "rounded border px-3 py-1 text-xs font-semibold transition-colors",
    active
      ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]",
  ].join(" ");

export function resolveSourceBadge(flag: {
  readOnly: boolean;
  source: "GLOBAL_DEFAULT" | "TENANT_OVERRIDE";
}): { id: "entitlement" | "platform" | "override"; label: string } {
  if (flag.readOnly) {
    return { id: "entitlement", label: "Entitlement" };
  }
  if (flag.source === "TENANT_OVERRIDE") {
    return { id: "override", label: "Override" };
  }
  return { id: "platform", label: "Platform default" };
}

export function isEffectiveValueEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean(value.enabled);
  }
  return false;
}
