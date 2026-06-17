import { describe, expect, it } from "vitest";
import { assertProtectedRouteMetadata, assertPublicRouteMetadata } from "@atlas/authorization";

describe("route metadata validation", () => {
  it("accepts protected tenant route metadata", () => {
    expect(() =>
      assertProtectedRouteMetadata({
        permission: "membership.read",
        rateLimit: "authenticatedTenantRead",
        audit: "none",
        idempotency: "none",
      }),
    ).not.toThrow();
  });

  it("rejects protected routes without permission or with pub permission", () => {
    expect(() =>
      assertProtectedRouteMetadata({
        permission: "pub",
        rateLimit: "authenticatedTenantRead",
        audit: "none",
        idempotency: "none",
      }),
    ).toThrow("Protected route must declare a non-public permission");
  });

  it("rejects platform permissions on tenant routes", () => {
    expect(() =>
      assertProtectedRouteMetadata({
        permission: "platform.tenant.manage",
        rateLimit: "authenticatedTenantRead",
        audit: "none",
        idempotency: "none",
      }),
    ).toThrow("Protected tenant route must not declare platform permission");
  });

  it("accepts public route metadata", () => {
    expect(() =>
      assertPublicRouteMetadata({
        public: true,
        permission: "pub",
        rateLimit: "publicRead",
        idempotency: "none",
      }),
    ).not.toThrow();
  });

  it("rejects malformed public route metadata", () => {
    expect(() =>
      assertPublicRouteMetadata({
        public: false,
        permission: "profile.read",
        rateLimit: "publicRead",
        idempotency: "none",
      }),
    ).toThrow("Public route must declare public=true and permission=pub");
  });
});
