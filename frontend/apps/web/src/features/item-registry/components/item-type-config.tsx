import type { ElementType } from "react";
import {
  AlignLeft,
  ArrowUpDown,
  CheckSquare,
  FileUp,
  HelpCircle,
  Layers,
  Link2,
  ListChecks,
  PenLine,
  ToggleLeft,
} from "lucide-react";

export type ItemTypeVisualConfig = {
  icon: ElementType;
  badgeClassName: string;
  chipClassName: string;
};

const primaryBadge =
  "bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-on-primary-container)]";

const primaryChip =
  "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] text-[var(--admin-primary)]";

const scormBadge =
  "bg-[color-mix(in_srgb,var(--admin-lesson-scorm)_16%,var(--admin-surface))] text-[var(--admin-lesson-scorm)]";

const scormChip =
  "border-[color-mix(in_srgb,var(--admin-lesson-scorm)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-scorm)_16%,var(--admin-surface))] text-[var(--admin-lesson-scorm)]";

const quizBadge =
  "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]";

const quizChip =
  "border-[color-mix(in_srgb,var(--admin-lesson-quiz)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]";

const warningBadge =
  "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const warningChip =
  "border-[color-mix(in_srgb,var(--admin-warning)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const assignmentBadge =
  "bg-[color-mix(in_srgb,var(--admin-lesson-assignment)_16%,var(--admin-surface))] text-[var(--admin-lesson-assignment)]";

const assignmentChip =
  "border-[color-mix(in_srgb,var(--admin-lesson-assignment)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-assignment)_16%,var(--admin-surface))] text-[var(--admin-lesson-assignment)]";

const liveBadge =
  "bg-[color-mix(in_srgb,var(--admin-lesson-live)_16%,var(--admin-surface))] text-[var(--admin-lesson-live)]";

const liveChip =
  "border-[color-mix(in_srgb,var(--admin-lesson-live)_45%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-live)_16%,var(--admin-surface))] text-[var(--admin-lesson-live)]";

export const DEFAULT_ITEM_TYPE_VISUAL: ItemTypeVisualConfig = {
  icon: HelpCircle,
  badgeClassName:
    "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  chipClassName:
    "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
};

/** Keys seeded in `backend/prisma/seeds/04-item-types.ts`. */
export const ITEM_TYPE_VISUALS: Record<string, ItemTypeVisualConfig> = {
  mcq_single: {
    icon: ListChecks,
    badgeClassName: primaryBadge,
    chipClassName: primaryChip,
  },
  mcq_multi: {
    icon: CheckSquare,
    badgeClassName: primaryBadge,
    chipClassName: primaryChip,
  },
  true_false: {
    icon: ToggleLeft,
    badgeClassName: scormBadge,
    chipClassName: scormChip,
  },
  fill_blank: {
    icon: PenLine,
    badgeClassName: warningBadge,
    chipClassName: warningChip,
  },
  short_answer: {
    icon: AlignLeft,
    badgeClassName: quizBadge,
    chipClassName: quizChip,
  },
  long_answer: {
    icon: AlignLeft,
    badgeClassName: assignmentBadge,
    chipClassName: assignmentChip,
  },
  matching: {
    icon: Link2,
    badgeClassName: scormBadge,
    chipClassName: scormChip,
  },
  ordering: {
    icon: ArrowUpDown,
    badgeClassName: assignmentBadge,
    chipClassName: assignmentChip,
  },
  file_upload: {
    icon: FileUp,
    badgeClassName: liveBadge,
    chipClassName: liveChip,
  },
  swipe: {
    icon: Layers,
    badgeClassName: liveBadge,
    chipClassName: liveChip,
  },
};

/** Legacy UI/mock keys mapped to seeded backend keys. */
const LEGACY_TYPE_ALIASES: Record<string, string> = {
  multiple_choice: "mcq_single",
  fill_in_blank: "fill_blank",
  chart_analysis: "mcq_single",
};

export function resolveItemTypeKey(key: string): string {
  return LEGACY_TYPE_ALIASES[key] ?? key;
}

export function getItemTypeVisual(key: string): ItemTypeVisualConfig {
  const resolved = resolveItemTypeKey(key);
  return ITEM_TYPE_VISUALS[resolved] ?? DEFAULT_ITEM_TYPE_VISUAL;
}
