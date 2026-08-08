export {
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  selectClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

export const builderSectionClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const builderSectionHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3";

export const builderSectionTitleClassName =
  "text-[13px] font-bold uppercase tracking-tight text-[var(--admin-on-surface)]";

export const builderSectionBodyClassName = "p-5";

export const builderFieldLabelClassName =
  "text-sm font-semibold text-[var(--admin-on-surface)]";

export const builderHelperClassName = "text-xs text-[var(--admin-on-surface-variant)]";

export const builderPanelClassName =
  "flex h-full flex-col border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const builderTextareaClassName =
  "w-full resize-y rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const builderDangerOutlineClassName =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50";

export const builderGhostIconClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]";

export function accessModeLabel(mode: "open" | "enrollment_required" | "invite_only"): string {
  if (mode === "open") return "Immediate full access";
  if (mode === "invite_only") return "Manual approval";
  return "Sequential unlock";
}
