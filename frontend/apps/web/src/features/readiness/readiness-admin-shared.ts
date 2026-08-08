export {
  alertErrorClassName,
  fieldClassName,
  formatRelativeUpdatedAt,
  ghostButtonClassName,
  labelClassName,
  monoClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  publishedLiveBadgeClassName,
  statusDraftBadgeClassName,
} from "../competency/competency-admin-shared";

export { selectClassName as readinessSelectClassName } from "../../app/admin/branding/_components/branding-admin-shared";

/** Compact header action for “Add …” controls in admin panels */
export const panelAddButtonClassName =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,var(--admin-surface))] motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export const panelSubheaderClassName =
  "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/60 px-4 py-2.5 sm:px-5";

export const checklistRowClassName =
  "flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 transition-[border-color,background-color] duration-200";

export const ruleRowClassName =
  "grid grid-cols-1 items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:grid-cols-12 sm:gap-4 sm:p-4";

export const ctaPreviewPanelClassName =
  "relative flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface))] p-6 text-center";

export const stickyFooterClassName =
  "sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_88%,transparent)] px-4 py-4 backdrop-blur-md sm:-mx-0 sm:rounded-xl sm:border sm:shadow-sm";

export const prominenceOptions = ["hidden", "subtle", "standard", "prominent"] as const;

export function prominenceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function splitHttpsUrl(url: string): { hostPath: string } {
  if (url.startsWith("https://")) {
    return { hostPath: url.slice("https://".length) };
  }
  if (url.startsWith("http://")) {
    return { hostPath: url.slice("http://".length) };
  }
  return { hostPath: url };
}

export function joinHttpsUrl(hostPath: string): string {
  const trimmed = hostPath.trim().replace(/^https?:\/\//, "");
  return trimmed ? `https://${trimmed}` : "https://";
}

export const defaultLegalChecklist = [
  "I have verified all redirect targets are secure.",
  "Legal disclaimer matches the latest regulatory update.",
  "Prominence rules align with the current risk disclosure policy.",
  "CTA copy has been approved by the brand marketing team.",
] as const;
