import { describe, expect, it } from "vitest";
import {
  meOutputSchema,
  publicAuthOutputSchema,
  publicLoginInputSchema,
  publicSignupInputSchema,
} from "@atlas/auth";

describe("auth request/response schemas", () => {
  it("accepts valid signup input", () => {
    expect(
      publicSignupInputSchema.parse({
        email: " User@Example.com ",
        password: "password123",
      }),
    ).toEqual({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("rejects short signup passwords", () => {
    expect(() =>
      publicSignupInputSchema.parse({
        email: "user@example.com",
        password: "short",
      }),
    ).toThrow();
  });

  it("accepts valid login input", () => {
    expect(
      publicLoginInputSchema.parse({
        email: "user@example.com",
        password: "secret",
      }),
    ).toEqual({
      email: "user@example.com",
      password: "secret",
    });
  });

  it("accepts signed-in auth output without internal principal ids", () => {
    const parsed = publicAuthOutputSchema.parse({
      data: {
        status: "signed_in",
        identity: {
          authenticated: true,
          email: "user@example.com",
          emailNormalized: "user@example.com",
          mfaEnabled: false,
          globalStatus: "active",
        },
      },
    });

    expect(parsed.data.identity).not.toHaveProperty("id");
    expect(parsed.data.identity).not.toHaveProperty("supabaseUserId");
  });

  it("accepts verification-required auth output without identity", () => {
    expect(
      publicAuthOutputSchema.parse({
        data: {
          status: "verification_required",
        },
      }),
    ).toEqual({
      data: {
        status: "verification_required",
      },
    });
  });

  it("accepts me output with tenant and session-safe identity", () => {
    const parsed = meOutputSchema.parse({
      data: {
        tenant: {
          id: "018f0000-0000-7000-8000-000000000001",
          slug: "tenant-a",
          state: "ACTIVE",
        },
        identity: {
          authenticated: true,
          email: "user@example.com",
          emailNormalized: "user@example.com",
          mfaEnabled: false,
          globalStatus: "active",
        },
      },
    });

    expect(parsed.data.identity).not.toHaveProperty("id");
    expect(parsed.data.tenant.slug).toBe("tenant-a");
  });
});
