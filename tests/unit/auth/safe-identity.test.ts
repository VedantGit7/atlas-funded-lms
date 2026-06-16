import { describe, expect, it } from "vitest";
import { toSessionSafeIdentity } from "@atlas/auth";

describe("session-safe identity projection", () => {
  it("returns only session-safe fields", () => {
    const identity = toSessionSafeIdentity({
      id: "018f0000-0000-7000-8000-000000000099",
      email: "User@Example.com",
      emailNormalized: "user@example.com",
      globalStatus: "active",
      mfaEnabled: true,
      lastLoginAt: new Date("2026-06-17T00:00:00.000Z"),
    });

    expect(identity).toEqual({
      authenticated: true,
      email: "User@Example.com",
      emailNormalized: "user@example.com",
      mfaEnabled: true,
      globalStatus: "active",
    });
    expect(identity).not.toHaveProperty("id");
    expect(identity).not.toHaveProperty("supabaseUserId");
    expect(identity).not.toHaveProperty("lastLoginAt");
  });
});
