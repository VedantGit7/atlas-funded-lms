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

/**
 * Why a mutation writes no audit entry (audit M7).
 *
 * Every tenant mutation declares `audit: "required"` unless it is one of these,
 * and `pnpm ci:audit-metadata` holds that rule. They are high-volume actions a
 * member takes on their own account, recorded in their own tables, where an
 * audit entry would add volume and no accountability:
 *
 * - `learner_activity`: the member's own learning (attempts, practice,
 *   progress, polls, attendance, self-enrolment), kept in its domain tables;
 * - `member_content`: posts, comments, reactions, reviews and messages the
 *   member writes, where the row records its author and time;
 * - `own_preferences`: the member's own non-security settings and saved or
 *   read state (avatar, preferences, notification state, bookmarks);
 * - `read_only`: a POST that computes a result and changes nothing;
 * - `client_telemetry`: client-reported signals stored as events.
 *
 * Never available to a sensitive permission (roles, membership, payments,
 * data export, …); the guard refuses it there.
 */
export type AuditExemption =
  | "learner_activity"
  | "member_content"
  | "own_preferences"
  | "read_only"
  | "client_telemetry";

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
  /**
   * "required": the mutation is on the audit record. The route wrapper checks
   * that the handler wrote an entry and records one itself if not (M7).
   */
  audit: "none" | "required";
  /** Required on a mutation declaring audit: "none"; see AuditExemption. */
  auditExempt?: AuditExemption;
  rateLimit: string;
  idempotency: "none" | "required";
  /**
   * Require verified current-session AAL2 for this route, not just enrollment.
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
