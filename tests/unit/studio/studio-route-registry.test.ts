import { describe, expect, it } from "vitest";
import {
  STUDIO_ROUTE_REGISTRY,
  getStudioRouteByScreenId,
  listStudioScreenIds,
} from "../../../frontend/apps/web/src/features/studio/studio-route-registry";

describe("studio route registry", () => {
  it("defines exact I1-I14 contract registry", () => {
    const screenIds = listStudioScreenIds();
    expect(screenIds).toHaveLength(14);
    expect(screenIds[0]).toBe("I1");
    expect(screenIds[13]).toBe("I14");
  });

  it("maps known screens to approved paths", () => {
    expect(getStudioRouteByScreenId("I1").pathPattern).toBe("/studio");
    expect(getStudioRouteByScreenId("I2").pathPattern).toBe("/studio/courses");
    expect(getStudioRouteByScreenId("I8").detailPathPattern).toBe("/studio/assessments/:id");
    expect(getStudioRouteByScreenId("I9").detailPathPattern).toBe("/studio/learning-paths/:id");
    expect(getStudioRouteByScreenId("I12").pathPattern).toBe("/studio/courses/:id/learners");
    expect(getStudioRouteByScreenId("I13").pathPattern).toBe("/studio/analytics");
    expect(getStudioRouteByScreenId("I14").pathPattern).toBe("/studio/review");
  });

  it("declares route-level entitlements only for I13 analytics", () => {
    const entitled = STUDIO_ROUTE_REGISTRY.filter((entry) => entry.entitlement);
    expect(entitled.map((entry) => entry.screenId)).toEqual(["I13"]);
  });
});
