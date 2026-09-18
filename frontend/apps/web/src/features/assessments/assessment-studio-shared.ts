import type { LucideIcon } from "lucide-react";
import { Award, ClipboardPen, GraduationCap, HelpCircle, Stethoscope } from "lucide-react";

const successBadge =
  "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]";

const warningBadge =
  "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const primaryBadge =
  "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]";

const primaryChipSelected =
  "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_20%,transparent)]";

const QUIZ_TYPE_CONFIG = {
  label: "Quiz",
  icon: HelpCircle,
  className: primaryBadge,
  chipSelected: primaryChipSelected,
  iconSurface:
    "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]",
};

export const ASSESSMENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; className: string; chipSelected: string; iconSurface: string }
> = {
  quiz: QUIZ_TYPE_CONFIG,
  exam: {
    label: "Exam",
    icon: GraduationCap,
    className:
      "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-danger)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    iconSurface:
      "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
  },
  diagnostic: {
    label: "Diagnostic",
    icon: Stethoscope,
    className: warningBadge,
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
    iconSurface:
      "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  },
  readiness_review: {
    label: "Readiness",
    icon: Award,
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-lesson-quiz)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    iconSurface:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
  },
  assignment: {
    label: "Assignment",
    icon: ClipboardPen,
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    chipSelected:
      "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_40%,var(--admin-surface))] text-[var(--admin-primary)]",
    iconSurface: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  },
  section_quiz: {
    label: "Section quiz",
    icon: HelpCircle,
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    chipSelected:
      "border-[color-mix(in_srgb,var(--admin-lesson-quiz)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    iconSurface:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
  },
};

export const DEFAULT_ASSESSMENT_TYPE = QUIZ_TYPE_CONFIG;

export const ASSESSMENT_TYPE_OPTIONS = [
  { value: "quiz" as const, label: "Quiz" },
  { value: "exam" as const, label: "Exam" },
  { value: "diagnostic" as const, label: "Diagnostic" },
  { value: "readiness_review" as const, label: "Readiness" },
  { value: "assignment" as const, label: "Assignment" },
];

export const STATUS_CONFIG: Record<string, string> = {
  DRAFT: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  REVIEW: warningBadge,
  PUBLISHED: successBadge,
  ARCHIVED:
    "bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_12%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REVIEW: "Review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export {
  badgeClassName,
  cardSectionTitleClassName,
  inputClass,
  insetFormInnerClassName,
  insetFormShellClassName,
  labelClass,
  panelClassName,
  panelScrollClassName,
  secondaryButtonClassName,
  sectionHeaderClassName,
} from "../learning-paths/learning-path-studio-shared";

export const typeChipGroupClassName = "flex flex-wrap gap-1.5";

export const typeChipButtonBase =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] px-3 py-2 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-[border-color,color,background-color,box-shadow] duration-200 motion-safe:active:scale-[0.98] hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] hover:text-[var(--admin-primary)] disabled:opacity-40";

export function typeChipButtonClassName(isSelected: boolean, chipSelected: string): string {
  if (isSelected) {
    return `${typeChipButtonBase} ${chipSelected}`;
  }
  return typeChipButtonBase;
}

export const listRowClassName =
  "group flex flex-col gap-3 border-b border-[var(--admin-border)] p-4 transition-colors last:border-b-0 hover:bg-[var(--admin-surface-low)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5";

export const listRowReviewAccentClassName = "border-l-4 border-l-[var(--admin-warning)]";

export const toggleTrackClassName =
  "relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-[var(--admin-surface-high)] transition-colors peer-checked:bg-[var(--admin-primary)] peer-disabled:cursor-not-allowed peer-disabled:opacity-40";

export const toggleThumbClassName =
  "pointer-events-none absolute left-0.5 top-0.5 block h-3.5 w-3.5 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform peer-checked:translate-x-[14px]";

export function formatAssessmentDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function itemDisplayTitle(contentJson: Record<string, unknown> | undefined): string {
  if (!contentJson) return "Untitled item";
  for (const key of ["prompt", "question", "stem", "title"]) {
    const value = contentJson[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "Untitled item";
}
