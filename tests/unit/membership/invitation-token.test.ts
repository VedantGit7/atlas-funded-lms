import { describe, expect, it } from "vitest";
import {
  acceptInvitationInputSchema,
  hashInvitationToken,
  invitationTokenSchema,
} from "@atlas/membership";

describe("invitation token helpers", () => {
  it("hashes tokens deterministically", () => {
    const token = "invite-token-abcdefghijklmnopqrstuvwxyz123456";

    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).toHaveLength(64);
  });

  it("accepts URL-safe invitation tokens", () => {
    expect(invitationTokenSchema.parse("AbCdEf1234567890._~abcdefghijklmnopqrstuvwxyz")).toBe(
      "AbCdEf1234567890._~abcdefghijklmnopqrstuvwxyz",
    );
  });

  it("rejects malformed invitation tokens", () => {
    expect(() => invitationTokenSchema.parse("bad token!")).toThrow();
    expect(() => invitationTokenSchema.parse("short")).toThrow();
  });

  it("validates accept invitation input", () => {
    expect(
      acceptInvitationInputSchema.parse({
        token: "valid-invite-token-abcdefghijklmnopqrstuvwxyz1234",
      }),
    ).toEqual({
      token: "valid-invite-token-abcdefghijklmnopqrstuvwxyz1234",
    });
  });
});
