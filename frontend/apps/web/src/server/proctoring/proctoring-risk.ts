// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type ProctoringRiskBand = "clean" | "mild" | "elevated" | "egregious";

/** Deterministic per-event weights. Advisory only — never auto-fail. */
export const PROCTORING_EVENT_WEIGHTS: Record<string, number> = {
  tab_hidden: 1,
  window_blur: 1,
  fullscreen_exit: 2,
  copy: 2,
  paste: 2,
  cut: 2,
  context_menu: 2,
  devtools_heuristic: 3,
  face_present: 0,
  face_absent: 4,
  multiple_faces: 5,
  microphone_activity: 2,
  media_permission_denied: 1,
  media_unavailable: 1,
  identity_verification_passed: 0,
  identity_verification_failed: 15,
  identity_verification_degraded: 3,
};

/** Minimum session level required to accept each event type. */
export const PROCTORING_EVENT_MIN_LEVEL: Record<string, number> = {
  tab_hidden: 1,
  window_blur: 1,
  fullscreen_exit: 1,
  copy: 1,
  paste: 1,
  cut: 1,
  context_menu: 1,
  devtools_heuristic: 1,
  face_present: 2,
  face_absent: 2,
  multiple_faces: 2,
  microphone_activity: 2,
  media_permission_denied: 2,
  media_unavailable: 2,
  identity_verification_passed: 3,
  identity_verification_failed: 3,
  identity_verification_degraded: 3,
};

export function riskBandForScore(score: number): ProctoringRiskBand {
  if (score <= 0) return "clean";
  if (score <= 9) return "mild";
  if (score <= 24) return "elevated";
  return "egregious";
}

/**
 * Pure deterministic risk score for golden fixtures.
 * Given the same event-type multiset, always returns the same score + band.
 */
export function computeProctoringRiskScore(eventTypes: readonly string[]): {
  score: number;
  band: ProctoringRiskBand;
  raw: number;
} {
  let raw = 0;
  for (const eventType of eventTypes) {
    raw += PROCTORING_EVENT_WEIGHTS[eventType] ?? 0;
  }
  const score = Math.min(100, raw);
  return {
    score,
    band: riskBandForScore(score),
    raw,
  };
}

/** Golden fixture event multisets used by unit tests. */
export const PROCTORING_RISK_GOLDEN_FIXTURES = {
  clean: [] as const,
  mild: ["tab_hidden", "copy"] as const,
  elevated: ["face_absent", "multiple_faces", "microphone_activity", "devtools_heuristic"] as const,
  egregious: [
    "identity_verification_failed",
    "multiple_faces",
    "face_absent",
    "devtools_heuristic",
    "copy",
    "paste",
  ] as const,
} as const;
