export {
  fieldClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "../courses/course-builder-shared";

export const lessonCardClassName =
  "flex flex-col gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4";

export const lessonCardTitleClassName =
  "text-[13px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export const lessonFieldLabelClassName =
  "text-sm font-medium text-[var(--admin-on-surface-variant)]";

export const lessonInputClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";

export const lessonTextareaClassName =
  "w-full resize-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60";

export const lessonLockedInputClassName =
  "w-full cursor-not-allowed rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)] opacity-70 outline-none";

export const lessonDangerIconButtonClassName =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--admin-danger)] text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50";

export const lessonToolbarButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:pointer-events-none disabled:opacity-40";

export const lessonSegmentedControlClassName =
  "inline-flex rounded-lg bg-[var(--admin-surface-high)] p-1";

export const lessonSegmentActiveClassName =
  "rounded-md bg-[var(--admin-surface)] px-6 py-1.5 text-xs font-semibold text-[var(--admin-primary)] shadow-sm transition-all";

export const lessonSegmentInactiveClassName =
  "rounded-md px-6 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]";

export function formatDurationMmSs(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function parseDurationMmSs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const clockMatch = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (clockMatch) {
    const minutes = Number(clockMatch[1]);
    const seconds = Number(clockMatch[2]);
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber) || asNumber < 0) return null;
  return Math.floor(asNumber);
}

export function countLines(value: string): number {
  if (!value) return 1;
  return value.split("\n").length;
}

export function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
