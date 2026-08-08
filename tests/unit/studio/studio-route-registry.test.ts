import { describe, expect, it } from "vitest";
import {
  STUDIO_ROUTE_REGISTRY,
  getStudioRouteByScreenId,
  listStudioScreenIds,
} from "../../../frontend/apps/web/src/features/studio/studio-route-registry";

describe("studio route registry", () => {
  it("defines exact I1-I13 contract registry", () => {
    const screenIds = listStudioScreenIds();
    expect(screenIds).toHaveLength(13);
    expect(screenIds[0]).toBe("I1");
    expect(screenIds[12]).toBe("I13");
  });

  it("maps known screens to approved paths", () => {
    expect(getStudioRouteByScreenId("I1").pathPattern).toBe("/studio");
    expect(getStudioRouteByScreenId("I2").pathPattern).toBe("/studio/courses");
    expect(getStudioRouteByScreenId("I8").detailPathPattern).toBe("/studio/assessments/:id");
    expect(getStudioRouteByScreenId("I9").detailPathPattern).toBe("/studio/learning-paths/:id");
    expect(getStudioRouteByScreenId("I12").pathPattern).toBe("/studio/courses/:id/learners");
    expect(getStudioRouteByScreenId("I13").pathPattern).toBe("/studio/analytics");
  });

  it("declares route-level entitlements only for I13 analytics", () => {
    const entitled = STUDIO_ROUTE_REGISTRY.filter((entry) => entry.entitlement);
    expect(entitled.map((entry) => entry.screenId)).toEqual(["I13"]);
  });
});
