import { describe, expect, it } from "vitest";
import {
  membershipPending,
  membershipRemoved,
  membershipStatusToError,
  membershipSuspended,
  noMembership,
} from "@atlas/membership";

describe("membership status errors", () => {
  it("maps missing membership to NO_MEMBERSHIP", () => {
    expect(noMembership()).toMatchObject({
      code: "NO_MEMBERSHIP",
      status: 403,
    });
  });

  it.each([
    ["INVITED", "MEMBERSHIP_PENDING"],
    ["SUSPENDED", "MEMBERSHIP_SUSPENDED"],
    ["REMOVED", "MEMBERSHIP_REMOVED"],
  ] as const)("maps %s to %s", (status, code) => {
    expect(membershipStatusToError(status)).toMatchObject({
      code,
      status: 403,
    });
  });

  it("throws for ACTIVE status mapping", () => {
    expect(() => membershipStatusToError("ACTIVE")).toThrow("ACTIVE membership is not an error");
  });

  it("uses safe membership error messages", () => {
    expect(membershipPending().message).toContain("invitation");
    expect(membershipSuspended().message).toContain("suspended");
    expect(membershipRemoved().message).toContain("no longer active");
  });
});
