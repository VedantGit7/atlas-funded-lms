// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type ProgressStatus = "not_started" | "in_progress" | "completed";

export function computeProgressPct(
  positionSeconds: number,
  durationSeconds: number | null | undefined,
): number {
  if (durationSeconds == null || durationSeconds <= 0) {
    return positionSeconds > 0 ? 1 : 0;
  }

  const pct = Math.round((positionSeconds / durationSeconds) * 100);
  return Math.min(100, Math.max(0, pct));
}

export function computePositionSeconds(
  progressPct: number,
  durationSeconds: number | null | undefined,
): number | null {
  if (durationSeconds == null || durationSeconds <= 0) {
    return null;
  }

  return Math.round((progressPct / 100) * durationSeconds);
}

export function boundPositionSeconds(
  positionSeconds: number,
  durationSeconds: number | null | undefined,
): number {
  if (durationSeconds == null || durationSeconds <= 0) {
    return Math.max(0, positionSeconds);
  }

  return Math.min(durationSeconds, Math.max(0, positionSeconds));
}

export function shouldAdvanceProgressPct(
  existingPct: number,
  nextPct: number,
  existingStatus: ProgressStatus,
): number {
  if (existingStatus === "completed") {
    return 100;
  }

  return Math.max(existingPct, nextPct);
}

export function resolveProgressStatus(args: {
  existingStatus: ProgressStatus;
  completed: boolean;
  progressPct: number;
}): ProgressStatus {
  if (args.existingStatus === "completed" || args.completed) {
    return "completed";
  }

  if (args.progressPct > 0) {
    return "in_progress";
  }

  return "not_started";
}

export function isFirstCompletion(args: {
  existingStatus: ProgressStatus;
  completed: boolean;
}): boolean {
  return args.existingStatus !== "completed" && args.completed;
}

export function isCompletionIdempotent(existingStatus: ProgressStatus): boolean {
  return existingStatus === "completed";
}
