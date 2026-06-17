import type { ResourceRef } from "./types";

export type RateLimitBucket =
  | "publicRead"
  | "publicAuth"
  | "publicInvitationAccept"
  | "authenticatedTenantRead"
  | "authenticatedTenantWrite";

export type AuditRequirement = "none" | "required";

export type IdempotencyRequirement = "none" | "required";

export type RouteMetadata = {
  public?: false;
  permission: string;
  resourceLoader?: string;
  audit: AuditRequirement;
  rateLimit: RateLimitBucket;
  idempotency: IdempotencyRequirement;
};

export type PublicRouteMetadata = {
  public: true;
  permission: "pub";
  audit?: AuditRequirement;
  rateLimit: RateLimitBucket;
  idempotency: IdempotencyRequirement;
};

export type RouteMetadataInput = {
  public?: boolean;
  permission?: string;
  resourceLoader?: string;
  audit?: AuditRequirement;
  rateLimit?: RateLimitBucket;
  idempotency?: IdempotencyRequirement;
};

export function assertProtectedRouteMetadata(metadata: RouteMetadataInput): void {
  if (!metadata.permission || metadata.permission === "pub") {
    throw new Error("Protected route must declare a non-public permission");
  }

  if (metadata.permission.startsWith("platform.")) {
    throw new Error("Protected tenant route must not declare platform permission");
  }

  if (!metadata.rateLimit) {
    throw new Error("Route metadata missing rateLimit");
  }

  if (!metadata.audit) {
    throw new Error("Route metadata missing audit requirement");
  }

  if (!metadata.idempotency) {
    throw new Error("Route metadata missing idempotency requirement");
  }
}

export function assertPublicRouteMetadata(metadata: RouteMetadataInput): void {
  if (metadata.public !== true || metadata.permission !== "pub") {
    throw new Error("Public route must declare public=true and permission=pub");
  }

  if (!metadata.rateLimit) {
    throw new Error("Public route metadata missing rateLimit");
  }

  if (!metadata.idempotency) {
    throw new Error("Public route metadata missing idempotency requirement");
  }
}

export type ResourceLoader<TInput = unknown> = (args: {
  tx: unknown;
  tenantId: string;
  actorMembershipId: string;
  input: TInput;
}) => Promise<ResourceRef>;
