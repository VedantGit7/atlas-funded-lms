import { describe, expect, it } from "vitest";
import {
  deriveProgressStatus,
  stepLockedFromGates,
} from "../../../apps/web/src/server/learning-paths/path-gate.service";

describe("path progress calculation", () => {
  it("marks step locked when any gate is not satisfied", () => {
    expect(stepLockedFromGates(["satisfied", "locked"])).toBe(true);
    expect(stepLockedFromGates(["satisfied"])).toBe(false);
  });

  it("derives progress status from lock/completion state", () => {
    expect(deriveProgressStatus({ locked: true, completed: false, inProgress: false })).toBe(
      "locked",
    );
    expect(deriveProgressStatus({ locked: false, completed: true, inProgress: false })).toBe(
      "completed",
    );
    expect(deriveProgressStatus({ locked: false, completed: false, inProgress: true })).toBe(
      "in_progress",
    );
    expect(deriveProgressStatus({ locked: false, completed: false, inProgress: false })).toBe(
      "unlocked",
    );
  });
});
