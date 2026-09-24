import { test } from "@playwright/test";

/** Numeric timing only; no URL, headers, credentials or response body is recorded. */
export function probePhase<T>(
  phase:
    | "J02 login"
    | "J02 enrollment"
    | "J02 course before enrollment"
    | "J02 course after enrollment"
    | "J03 login"
    | "J03 start"
    | "J03 autosave"
    | "J03 reload"
    | "J03 submit"
    | "J03 result"
    | "J03 intercept upstream"
    | "J03 intercept json"
    | "J03 intercept fulfill",
  action: () => Promise<T>,
): Promise<T> {
  test.info().annotations.push({
    type: phase.startsWith("J03 ") ? "j03-phase-start" : "j02-phase-start",
    description: JSON.stringify({ phase, startedAt: Date.now() }),
  });
  return test.step(phase, action);
}
