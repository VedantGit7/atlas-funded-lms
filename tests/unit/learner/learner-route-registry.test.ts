import { describe, expect, it } from "vitest";
import {
  LEARNER_ROUTE_REGISTRY,
  getLearnerRouteByScreenId,
  listLearnerScreenIds,
} from "../../../apps/web/src/features/learner/learner-route-registry";

describe("learner route registry", () => {
  it("defines exact L1-L25 contract registry", () => {
    const screenIds = listLearnerScreenIds();
    expect(screenIds).toHaveLength(25);
    expect(screenIds[0]).toBe("L1");
    expect(screenIds[24]).toBe("L25");
  });

  it("maps known screens to approved paths", () => {
    expect(getLearnerRouteByScreenId("L1").pathPattern).toBe("/");
    expect(getLearnerRouteByScreenId("L21").pathPattern).toBe("/resources");
    expect(getLearnerRouteByScreenId("L24").pathPattern).toBe("/profile");
    expect(getLearnerRouteByScreenId("L25").pathPattern).toBe("/settings");
  });

  it("declares route-level entitlements only for approved screens", () => {
    const entitled = LEARNER_ROUTE_REGISTRY.filter((entry) => entry.entitlement);
    expect(entitled.map((entry) => entry.screenId)).toEqual([
      "L14",
      "L15",
      "L16",
      "L17",
      "L18",
      "L19",
      "L20",
    ]);
  });
});
