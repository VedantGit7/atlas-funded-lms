import { test } from "@playwright/test";

/** Numeric timing only; no URL, headers, credentials or response body is recorded. */
export function probePhase<T>(
  phase:
    | "J02 login"
    | "J02 enrollment"
    | "J02 course before enrollment"
    | "J02 course after enrollment",
  action: () => Promise<T>,
): Promise<T> {
  test.info().annotations.push({
    type: "j02-phase-start",
    description: JSON.stringify({ phase, startedAt: Date.now() }),
  });
  return test.step(phase, action);
}
