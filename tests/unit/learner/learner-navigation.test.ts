import { describe, expect, it } from "vitest";
import {
  LEARNER_PRIMARY_NAV,
  filterLearnerNavigation,
} from "../../../apps/web/src/features/learner/learner-navigation";

describe("learner navigation projection", () => {
  it("filters entitlement-gated nav items", () => {
    const enabled = new Set<string>(["community.enable"]);
    const items = filterLearnerNavigation(LEARNER_PRIMARY_NAV, enabled);

    expect(items.some((item) => item.href === "/community")).toBe(true);
    expect(items.some((item) => item.href === "/certificates")).toBe(false);
    expect(items.some((item) => item.href === "/achievements")).toBe(false);
  });

  it("keeps core learner navigation without entitlements", () => {
    const items = filterLearnerNavigation(LEARNER_PRIMARY_NAV, new Set());
    expect(items.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/", "/courses", "/roadmap", "/progress", "/resources"]),
    );
  });

  it("does not branch on role names", () => {
    const source = LEARNER_PRIMARY_NAV.toString();
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });
});
