import { describe, expect, it } from "vitest";
import { EntitlementRequiredError, toSafeErrorEnvelope } from "@atlas/api";

describe("EntitlementRequiredError envelope", () => {
  it("maps entitlement failures separately from permission failures", () => {
    const envelope = toSafeErrorEnvelope(
      new EntitlementRequiredError("community.enable"),
      "req_test",
    );

    expect(envelope).toEqual({
      status: 403,
      body: {
        error: {
          code: "ENTITLEMENT_REQUIRED",
          message: "This feature is not enabled for this tenant.",
          requestId: "req_test",
        },
      },
    });
  });
});
