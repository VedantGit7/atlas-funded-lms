import { describe, expect, it } from "vitest";
import {
  APPROVED_POSTHOG_EVENTS,
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "@atlas/observability/posthog/taxonomy";

describe("posthog taxonomy", () => {
  it("allows only approved event names", () => {
    for (const event of APPROVED_POSTHOG_EVENTS) {
      expect(isApprovedPostHogEvent(event)).toBe(true);
    }
    expect(isApprovedPostHogEvent("page_view")).toBe(false);
  });

  it("rejects forbidden properties", () => {
    expect(() => assertNoForbiddenPostHogProperties({ email: "x@y.com" })).toThrow(
      /Forbidden PostHog property/,
    );
  });

  it("sanitizes approved properties only", () => {
    const props = sanitizePostHogProperties({
      tenantSafeId: "tenant_abc",
      email: "hidden",
      routeGroup: "learner",
    });
    expect(props.tenantSafeId).toBe("tenant_abc");
    expect(props.routeGroup).toBe("learner");
    expect(props.email).toBeUndefined();
  });
});
