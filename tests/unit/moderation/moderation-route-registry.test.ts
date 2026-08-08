import { describe, expect, it } from "vitest";
import {
  MODERATION_ROUTE_REGISTRY,
  listModerationScreenIds,
} from "../../../frontend/apps/web/src/features/moderation/moderation-route-registry";

describe("moderation route registry", () => {
  it("maps M1-M4 to approved moderation routes", () => {
    expect(listModerationScreenIds()).toEqual(["M1", "M2", "M3", "M4"]);
    expect(MODERATION_ROUTE_REGISTRY.map((entry) => entry.pathPattern)).toEqual([
      "/admin/moderation/cases",
      "/admin/moderation/cases/:id",
      "/admin/moderation/appeals",
      "/moderate/spaces",
    ]);
  });

  it("requires community.enable on every moderation screen", () => {
    for (const route of MODERATION_ROUTE_REGISTRY) {
      expect(route.entitlement).toBe("community.enable");
    }
  });
});
