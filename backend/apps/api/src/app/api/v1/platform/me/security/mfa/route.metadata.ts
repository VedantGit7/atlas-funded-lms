import type { PlatformRouteMetadata } from "@atlas/api/route-metadata";

// An operator setting up their first authenticator. Every platform role holds
// platform.tenant.read, so any active operator may enroll, and only an operator.
// mfa: "enrollment" lets a password-only session in while no factor is verified
// (create-platform-route.ts); after that these routes need aal2 like the rest.

export const mfaReadMetadata = {
  permission: "platform.tenant.read",
  audit: "platform_scope",
  rateLimit: "platformRead",
  idempotency: "none",
  reasonRequired: false,
  mfa: "enrollment",
} satisfies PlatformRouteMetadata;

// No idempotency record: replaying an enrollment would store its TOTP secret,
// and a repeated enrollment only creates another unverified factor.
export const mfaMutationMetadata = {
  permission: "platform.tenant.read",
  audit: "platform_scope",
  rateLimit: "platformMutation",
  idempotency: "none",
  reasonRequired: false,
  mfa: "enrollment",
} satisfies PlatformRouteMetadata;
