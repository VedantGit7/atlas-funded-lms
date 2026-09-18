const primaryBadge =
  "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]";

const primaryChipSelected =
  "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_20%,transparent)]";

const warningBadge =
  "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const warningChipSelected =
  "border-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const successBadge =
  "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";

export const PATH_TYPE_CONFIG = {
  program: {
    label: "Program",
    className: primaryBadge,
    chipSelected: primaryChipSelected,
    iconClassName:
      "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-primary)]",
  },
  roadmap: {
    label: "Roadmap",
    className: warningBadge,
    chipSelected: warningChipSelected,
    iconClassName:
      "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  },
} as const;

export const STATUS_CONFIG: Record<string, string> = {
  DRAFT: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  PUBLISHED: successBadge,
  ACTIVE: successBadge,
  ARCHIVED:
    "bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_12%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
  REVIEW: warningBadge,
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  REVIEW: "In review",
};

export const GATE_TYPE_CONFIG: Record<string, { className: string; label: string }> = {
  open: {
    className: successBadge,
    label: "Open",
  },
  previous_step_completed: {
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    label: "Previous step",
  },
  assessment_passed: {
    className: warningBadge,
    label: "Assessment passed",
  },
  competency_band: {
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    label: "Competency band",
  },
  manual: {
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    label: "Manual approval",
  },
  time_based: {
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-scorm)_16%,var(--admin-surface))] text-[var(--admin-lesson-scorm)]",
    label: "Time-based",
  },
};

export const GATE_TYPE_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "previous_step_completed", label: "Previous step completed" },
  { value: "assessment_passed", label: "Assessment passed" },
  { value: "competency_band", label: "Competency band" },
  { value: "time_based", label: "Time-based unlock" },
  { value: "manual", label: "Manual approval" },
] as const;

export const DEFAULT_GATE_CLASS =
  "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

export const STEP_TYPE_CONFIG: Record<string, string> = {
  course: primaryBadge,
  assessment: warningBadge,
  path: "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
};

export const inputClass =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] transition-all focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-50";

export const labelClass = "mb-1 block text-sm font-medium text-[var(--admin-on-surface)]";

export const panelClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const panelFlexClassName =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const sectionHeaderClassName =
  "flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3";

export const panelScrollClassName = "min-h-0 flex-1 overflow-y-auto overscroll-contain";

export const scrollColumnClassName = "h-full min-h-0 overflow-y-auto overscroll-contain";

export const insetFormShellClassName = "shrink-0 border-t border-[var(--admin-border)] p-3";

export const insetFormInnerClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4";

export const cardSectionTitleClassName =
  "text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const badgeClassName =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold";

export const typeSegmentGroupClassName =
  "grid grid-cols-2 gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1";

export const typeSegmentButtonBase =
  "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 motion-safe:active:scale-[0.98]";

export function typeSegmentButtonClassName(isSelected: boolean): string {
  if (isSelected) {
    return `${typeSegmentButtonBase} bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm`;
  }
  return `${typeSegmentButtonBase} text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]`;
}

export const secondaryButtonClassName =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-sm font-medium text-[var(--admin-on-surface-variant)] shadow-sm transition-[border-color,color,box-shadow] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] motion-safe:active:scale-[0.98]";

export function formatGateLabel(gateType: string, config: Record<string, unknown>): string {
  if (gateType === "competency_band" && typeof config["bandKey"] === "string") {
    return `${GATE_TYPE_CONFIG["competency_band"]?.label ?? "Competency"}: ${config["bandKey"]}`;
  }
  if (gateType === "time_based") {
    const days = config["daysSinceEnroll"];
    if (typeof days === "number") {
      return `Unlocks in ${String(days)} day${days === 1 ? "" : "s"}`;
    }
    const availableFrom = config["availableFrom"];
    if (typeof availableFrom === "string") {
      return `Unlocks on ${availableFrom.slice(0, 10)}`;
    }
  }
  if (gateType === "assessment_passed") {
    return "Assessment passed";
  }
  if (gateType === "previous_step_completed") {
    return "Previous step completed";
  }
  if (gateType === "manual") {
    return "Manual approval";
  }
  if (gateType === "open") {
    return "Open";
  }
  return gateType.replaceAll("_", " ");
}
