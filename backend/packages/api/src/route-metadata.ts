import type { ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";

export type TenantRouteContext = {
  tenantId: string;
  requestId: string;
  actorMembershipId: string;
  idempotencyKey?: string;
};

export type ResourceLoaderFn<TInput = unknown> = (args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  params: Record<string, string>;
  input: TInput;
}) => Promise<ResourceRef>;

/**
 * How many units of the declared entitlement one request consumes.
 *
 * Shaped like `resourceLoader` so a route can compute the figure from its own
 * input — an upload meters bytes, a bulk import meters rows. Returning 0 (or
 * omitting the field) means the route is gated by the entitlement but not
 * metered against it, which is every route's behaviour by default.
 *
 * Declaring this without an `entitlement` key meters nothing; the guard
 * `ci:entitlement-metadata` requires the key to be declared either way.
 */
export type EntitlementUsageFn<TInput = unknown> = (args: {
  ctx: TenantRouteContext;
  params: Record<string, string>;
  input: TInput;
}) => number;

export type RouteMetadata<TInput = unknown> = {
  public?: false;
  permission: string;
  entitlement?: string | null;
  /**
   * Opt in to quantitative metering of `entitlement` (audit finding M11).
   * Consumed after the permission decision, so a denied caller never burns
   * the tenant's quota.
   */
  entitlementUsage?: EntitlementUsageFn<TInput>;
  resourceLoader?: ResourceLoaderFn<TInput>;
  audit: "none" | "required";
  rateLimit: string;
  idempotency: "none" | "required";
  /**
   * H5: require a verified second factor for this route.
   *
   * Intended for the categories the audit named — tenant-admin destructive
   * actions, payouts and refunds, and data exports. Defaults to "none" so the
   * requirement is always visible at the route rather than implied by a
   * permission-name convention that would drift.
   */
  mfa?: "none" | "required";
};

export type PlatformRouteContext = {
  platformPrincipalId: string;
  requestId: string;
  reason: string;
  idempotencyKey: string;
};

export type PlatformRouteMetadata = {
  permission: string;
  audit: "none" | "required" | "platform_scope";
  rateLimit: string;
  idempotency: "none" | "required";
  reasonRequired?: boolean;
};
