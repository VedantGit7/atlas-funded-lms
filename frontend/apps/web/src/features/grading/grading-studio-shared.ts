import type { GradingQueueItem } from "./api";

const errorBadge =
  "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";

const warningBadge =
  "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]";

const neutralBadge = "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

export const GRADING_STATUS_CONFIG: Record<
  GradingQueueItem["status"],
  { label: string; className: string; dotClassName: string }
> = {
  PENDING: {
    label: "Pending",
    className: errorBadge,
    dotClassName: "bg-[var(--admin-danger)]",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: warningBadge,
    dotClassName: "bg-[var(--admin-warning)]",
  },
  GRADED: {
    label: "Graded",
    className:
      "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_16%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
    dotClassName: "bg-[var(--admin-lesson-quiz)]",
  },
  CANCELLED: {
    label: "Cancelled",
    className: neutralBadge,
    dotClassName: "bg-[var(--admin-on-surface-variant)]",
  },
};

export {
  badgeClassName,
  cardSectionTitleClassName,
  inputClass,
  labelClass,
  panelClassName,
  secondaryButtonClassName,
  sectionHeaderClassName,
} from "../learning-paths/learning-path-studio-shared";

export {
  primaryButtonClassName,
  outlineButtonClassName,
} from "../../app/admin/branding/_components/branding-admin-shared";

export const tableShellClassName =
  "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm";

export const tableHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]";

export const tableRowClassName =
  "group cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface-low))] motion-safe:active:bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface-low))]";

export const tableRowUrgentClassName = "border-l-[3px] border-l-[var(--admin-warning)]";

export const tableRowMutedClassName = "opacity-60";

export const itemTypeChipClassName =
  "rounded bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]";

export const statCardClassName =
  "flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm";

export const statLabelClassName =
  "text-[10px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]";

export const monoValueClassName = "font-mono text-sm text-[var(--admin-on-surface-variant)]";

export const panelHeaderEyebrowClassName =
  "text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export function learnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

const AVATAR_SURFACES = [
  "bg-[color-mix(in_srgb,var(--admin-warning)_22%,var(--admin-surface))] text-[var(--admin-warning)]",
  "bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))] text-[var(--admin-primary)]",
  "bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] text-[var(--admin-success)]",
  "bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_18%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]",
] as const;

export function learnerAvatarClassName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_SURFACES.length;
  }
  return AVATAR_SURFACES[hash] ?? AVATAR_SURFACES[0];
}

export function formatRelativeSubmittedAt(value: string | null): string {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0) return "Just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${String(days)} days ago`;

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isUrgentTask(task: GradingQueueItem): boolean {
  if (task.status !== "PENDING" || !task.submittedAt) return false;
  const ageMs = Date.now() - new Date(task.submittedAt).getTime();
  return ageMs >= 24 * 60 * 60 * 1000;
}

export function rowActionLabel(status: GradingQueueItem["status"]): string {
  switch (status) {
    case "PENDING":
      return "Grade now";
    case "IN_PROGRESS":
      return "Resume";
    case "GRADED":
      return "View details";
    case "CANCELLED":
      return "Archived";
  }
}

export function formatLearnerAnswer(value: unknown): { text: string; isCode: boolean } {
  if (value == null) {
    return { text: "No response submitted.", isCode: false };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.includes("\n") || /^(import |def |function |const |let |class )/.test(trimmed)) {
      return { text: trimmed, isCode: true };
    }
    return { text: trimmed || "No response submitted.", isCode: false };
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "answer", "response", "value", "code", "body"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return formatLearnerAnswer(candidate);
      }
    }
  }

  return { text: JSON.stringify(value, null, 2), isCode: true };
}

export function computeQueueStats(tasks: GradingQueueItem[]) {
  const pending = tasks.filter((task) => task.status === "PENDING").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const graded = tasks.filter((task) => task.status === "GRADED").length;
  const urgent = tasks.filter(isUrgentTask).length;
  const actionable = pending + inProgress;
  const completionRate =
    tasks.length > 0 ? Math.round(((tasks.length - actionable) / tasks.length) * 100) : null;

  return {
    total: tasks.length,
    pending,
    inProgress,
    graded,
    urgent,
    actionable,
    completionRate,
  };
}
