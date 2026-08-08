import type { WorkflowQueueItem } from "./api";

export {
  badgeClassName,
  inputClass,
  labelClass,
  panelClassName,
  sectionHeaderClassName,
  secondaryButtonClassName,
} from "../learning-paths/learning-path-studio-shared";

export {
  primaryButtonClassName,
  outlineButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";

export {
  formatRelativeSubmittedAt,
  learnerAvatarClassName,
  learnerInitials,
  panelHeaderEyebrowClassName,
} from "../grading/grading-studio-shared";

export type TargetFilter = "all" | "course" | "assessment" | "learning_path";

export const TARGET_FILTER_OPTIONS: Array<{ value: TargetFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "course", label: "Course" },
  { value: "assessment", label: "Assessment" },
  { value: "learning_path", label: "Path" },
];

export const TARGET_TYPE_CONFIG: Record<
  WorkflowQueueItem["target"]["type"],
  { label: string; shortLabel: string; className: string }
> = {
  course: {
    label: "Course",
    shortLabel: "Course",
    className:
      "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]",
  },
  assessment: {
    label: "Assessment",
    shortLabel: "Assessment",
    className:
      "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
  },
  learning_path: {
    label: "Learning path",
    shortLabel: "Path",
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
  },
};

export const REVIEW_STATE_BADGE =
  "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]";

export const queueShellClassName =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const queueHeaderClassName =
  "sticky top-0 z-10 shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const queueRowBaseClassName =
  "w-full border-b border-[var(--admin-border)] border-l-4 px-4 py-3 text-left transition-[background-color,border-color] duration-200 ease-out hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface-low))]";

export const queueRowSelectedClassName =
  "border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface-low))]";

export const queueRowIdleClassName = "border-l-transparent";

export const filterPillBaseClassName =
  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-200 ease-out motion-safe:active:scale-[0.98]";

export const detailPanelClassName =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const quoteBlockClassName =
  "relative rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5";

export const decisionFooterClassName =
  "shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-[0_-4px_16px_color-mix(in_srgb,var(--admin-on-surface)_6%,transparent)] sm:px-6";

export function formatTargetType(type: WorkflowQueueItem["target"]["type"]): string {
  return TARGET_TYPE_CONFIG[type].label;
}

export function formatLifecycleState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
}

export function studioHrefForTarget(item: WorkflowQueueItem): string {
  const { type, id } = item.target;
  if (type === "course") return `/studio/courses/${id}`;
  if (type === "assessment") return `/studio/assessments/${id}`;
  return `/studio/learning-paths/${id}`;
}

export function submitterLabel(membershipId: string): string {
  return `Reviewer ${membershipId.slice(0, 8)}`;
}

export function formatSubmittedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function filterPillClassName(selected: boolean): string {
  if (selected) {
    return `${filterPillBaseClassName} bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm`;
  }
  return `${filterPillBaseClassName} border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]`;
}

/** True when the server reports the queue row is outdated (already reviewed, etc.). */
export function isStaleWorkflowConflictError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been acted on") ||
    normalized.includes("no longer pending review") ||
    normalized.includes("no longer in review state")
  );
}
