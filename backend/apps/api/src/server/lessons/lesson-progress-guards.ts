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

/**
 * The status after a progress save. A save that isn't a completion means the
 * learner opened the lesson, so it's in progress even at 0%: the lesson page
 * saves once per visit and the embedded player reports no position yet.
 * "not_started" is a lesson with no progress row (launch plan 5.1, 6 November
 * 2026).
 */
export function resolveProgressStatus(args: {
  existingStatus: ProgressStatus;
  completed: boolean;
}): ProgressStatus {
  if (args.existingStatus === "completed" || args.completed) {
    return "completed";
  }

  return "in_progress";
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
