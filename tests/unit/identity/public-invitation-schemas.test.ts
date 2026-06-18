import { describe, expect, it } from "vitest";
import {
  AcceptInvitationRequestSchema,
  AcceptInvitationResponseSchema,
  mapInvitationAcceptResponse,
  redactTokenForLogging,
  safeInvitationErrorMessage,
} from "@atlas/domain-identity";

describe("public invitation schemas", () => {
  it("validates accept invitation request", () => {
    expect(
      AcceptInvitationRequestSchema.parse({
        token: "a".repeat(40),
      }).token,
    ).toHaveLength(40);
  });

  it("rejects tenant_id in invitation body", () => {
    expect(() =>
      AcceptInvitationRequestSchema.parse({
        token: "a".repeat(40),
        tenant_id: "spoofed",
      }),
    ).toThrow();
  });

  it("validates accepted response envelope", () => {
    expect(
      AcceptInvitationResponseSchema.parse({
        data: {
          status: "ACCEPTED",
          redirectTo: "/",
        },
      }),
    ).toBeTruthy();
  });
});

describe("public invitation ui helpers", () => {
  it("redacts invitation tokens for logging", () => {
    expect(redactTokenForLogging()).toBe("[redacted]");
  });

  it("returns safe invitation errors without leaking existence", () => {
    expect(safeInvitationErrorMessage("INVALID_INVITATION")).toBe(
      "This invitation is invalid or has expired.",
    );
    expect(safeInvitationErrorMessage("AUTH_REQUIRED")).toContain("Sign in");
  });

  it("maps unauthenticated accept to login required", () => {
    expect(
      mapInvitationAcceptResponse({
        authenticated: false,
        accepted: false,
        roleHome: null,
      }),
    ).toEqual({ status: "LOGIN_REQUIRED", redirectTo: null });
  });
});
