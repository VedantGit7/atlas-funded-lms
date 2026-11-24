import { describe, expect, it } from "vitest";
import { stepStatusLabel } from "../../../frontend/apps/web/src/features/learning-paths/components/PathStepList";
import { learnerFeatureLabel } from "../../../frontend/apps/web/src/features/learner/components/SubscriptionPanel";
import { LEARNER_PRIMARY_NAV } from "../../../frontend/apps/web/src/features/learner/learner-navigation";

type ProgressStep = Parameters<typeof stepStatusLabel>[0];

function progress(progressStatus: NonNullable<ProgressStep>["progressStatus"]): ProgressStep {
  return { progressStatus } as ProgressStep;
}

describe("learning path words (QA review 2 H19, review 1 m47)", () => {
  it("uses plain words, not raw statuses", () => {
    expect(stepStatusLabel(progress("in_progress"), true, 2)).toBe("In progress");
    expect(stepStatusLabel(progress("completed"), true, 1)).toBe("Completed");
    expect(stepStatusLabel(progress("unlocked"), true, 3)).toBe("Ready to start");
    expect(stepStatusLabel(progress("locked"), true, 3)).toBe("Locked");
  });

  it("doesn't call step 1 locked before the learner starts the path", () => {
    expect(stepStatusLabel(progress("locked"), false, 1)).toBe("First step");
    expect(stepStatusLabel(progress("locked"), false, 2)).toBe("Unlocks as you go");
  });

  it("puts learning paths in the learner menu", () => {
    expect(LEARNER_PRIMARY_NAV.find((item) => item.href === "/roadmap")?.label).toBe(
      "Learning paths",
    );
  });
});

describe("learner subscription features (QA review 2 H32)", () => {
  it("names learner features in plain words", () => {
    expect(learnerFeatureLabel("community.enable")).toBe("Community & discussion");
    expect(learnerFeatureLabel("certification.enable")).toBe("Certificates");
  });

  it("leaves out the academy's admin features instead of inventing names", () => {
    expect(learnerFeatureLabel("reports.library.view")).toBeNull();
    expect(learnerFeatureLabel("custom_domain.enable")).toBeNull();
  });
});
