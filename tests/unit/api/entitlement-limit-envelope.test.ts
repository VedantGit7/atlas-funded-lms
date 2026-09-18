import { describe, expect, it } from "vitest";
import { toSafeErrorEnvelope } from "@atlas/api";
import { EntitlementLimitExceededError, EntitlementRequiredError } from "@atlas/authorization";

/**
 * An exhausted plan allowance has to reach the client as a billing state.
 *
 * `EntitlementLimitExceededError` is a plain Error, not an `AtlasHttpError`, and
 * the envelope had no branch for it — so it fell through to the catch-all and
 * every metered route reported a reached limit as **500 Internal server error**.
 * The class's own comment says "402 rather than 403 ... this is a billing state,
 * not an authorization one", and nothing delivered that 402.
 */

const REQUEST_ID = "req_envelope_test";

describe("entitlement limit envelope", () => {
  it("maps an exhausted allowance to 402, not 500", () => {
    const envelope = toSafeErrorEnvelope(
      new EntitlementLimitExceededError("data.export.enable", 50, 50, "month"),
      REQUEST_ID,
    );

    expect(envelope.status).toBe(402);
    expect(envelope.body.error.code).toBe("ENTITLEMENT_LIMIT_EXCEEDED");
  });

  it("reports the figures the client needs to act on", () => {
    // "You have hit a limit" without the numbers leaves a client unable to say
    // whether to wait for the period or ask for a bigger plan.
    const envelope = toSafeErrorEnvelope(
      new EntitlementLimitExceededError("data.export.enable", 47, 50, "month"),
      REQUEST_ID,
    );

    expect(envelope.body.error.message).toContain("47");
    expect(envelope.body.error.message).toContain("50");
    expect(envelope.body.error.message).toContain("month");
  });

  it("carries the request id through", () => {
    const envelope = toSafeErrorEnvelope(
      new EntitlementLimitExceededError("data.export.enable", 1, 1, "day"),
      REQUEST_ID,
    );

    expect(envelope.body.error.requestId).toBe(REQUEST_ID);
  });

  it("keeps a missing entitlement distinct from an exhausted one", () => {
    // Different remedies: one needs a plan that includes the capability, the
    // other needs a higher limit or the next period. Collapsing them would tell
    // a paying tenant their feature is switched off.
    const missing = toSafeErrorEnvelope(
      new EntitlementRequiredError("data.export.enable"),
      REQUEST_ID,
    );
    const exhausted = toSafeErrorEnvelope(
      new EntitlementLimitExceededError("data.export.enable", 50, 50, "month"),
      REQUEST_ID,
    );

    expect(missing.status).toBe(403);
    expect(exhausted.status).toBe(402);
    expect(missing.body.error.code).not.toBe(exhausted.body.error.code);
  });

  it("does not leak the entitlement key into the message", () => {
    // The key is internal plan vocabulary; the numbers are what a client acts
    // on. Keeping it out also keeps the message identical across capabilities.
    const envelope = toSafeErrorEnvelope(
      new EntitlementLimitExceededError("data.export.enable", 5, 5, "month"),
      REQUEST_ID,
    );

    expect(envelope.body.error.message).not.toContain("data.export.enable");
  });

  it("still buries an unrecognised error", () => {
    // The catch-all must keep hiding internals; this change widens what is
    // reported deliberately, not accidentally.
    const envelope = toSafeErrorEnvelope(new Error("connection string leaked"), REQUEST_ID);

    expect(envelope.status).toBe(500);
    expect(envelope.body.error.message).not.toContain("connection string");
  });
});
