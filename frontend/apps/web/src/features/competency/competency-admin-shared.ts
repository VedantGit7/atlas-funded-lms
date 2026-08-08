import type { LucideIcon } from "lucide-react";
import { BarChart3, Brain, Shield, Target } from "lucide-react";
import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import { formatRelativeUpdatedAt } from "../../app/admin/branding/_components/branding-admin-shared";

export {
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  ghostButtonClassName,
  formatRelativeUpdatedAt,
} from "../../app/admin/branding/_components/branding-admin-shared";

export const panelClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const panelHeaderClassName =
  "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:px-5";

export const panelBodyClassName = "p-4 sm:p-5";

export const panelEyebrowClassName =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const monoClassName = "font-mono text-[12px] leading-4 text-[var(--admin-on-surface-variant)]";

export const tableHeadClassName =
  "bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";

export const tableInputClassName =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-border)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/25 disabled:opacity-60";

export const tableMonoInputClassName = `${tableInputClassName} font-mono text-[12px]`;

export const profileRowBaseClassName =
  "flex w-full items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--admin-surface-low)]";

export const profileRowSelectedClassName =
  "border-l-4 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]";

export const dimensionIconClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

export const alertErrorClassName =
  "rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]";

export const alertInfoClassName =
  "flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-on-surface)]";

export const statusActiveBadgeClassName =
  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight bg-[var(--admin-primary)] text-[var(--admin-on-primary)]";

export const statusDraftBadgeClassName =
  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

export const publishedLiveBadgeClassName =
  "inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-bold text-[var(--admin-success)]";

const DIMENSION_ICONS: LucideIcon[] = [Shield, BarChart3, Brain, Target];

export function dimensionIconForIndex(index: number): LucideIcon {
  return DIMENSION_ICONS[index % DIMENSION_ICONS.length] ?? Target;
}

export function formatProfileSubtitle(profile: ScoringProfileDto): string {
  const version =
    profile.activeVersion != null ? `Version ${String(profile.activeVersion)}` : "Unpublished draft";
  const updated = formatRelativeUpdatedAt(profile.updatedAt);
  return `${version} · Updated ${updated}`;
}

export function profileStatusLabel(profile: ScoringProfileDto): string {
  if (profile.status === "ARCHIVED") return "Archived";
  if (profile.activeVersion != null) return "Active";
  return profile.status === "ACTIVE" ? "Draft" : profile.status;
}

export function slugifyBandKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "band";
}
