import type { TenantTx } from "@atlas/db";
import {
  consumeEntitlementUsage,
  findActiveEntitlementByKey,
  parseEntitlementValue,
} from "@atlas/domain-config";
import { EntitlementRequiredError, EntitlementLimitExceededError } from "./entitlement-errors";

/**
 * Audit finding M11 — quantitative entitlement enforcement.
 *
 * This originally checked key existence only: `Entitlement.value_json` was never
 * read and the `usageContext` parameter was declared and then ignored, so plan
 * limits could be expressed but not enforced.
 *
 * The gate and the meter are deliberately separate calls. `enforceEntitlement`
 * answers "may this tenant use the capability at all", and the route wrapper
 * runs it before the permission check. `consumeEntitlementUnits` answers "and
 * does this request fit inside the plan", and only runs **after** the permission
 * decision has passed — otherwise a caller who is about to be denied would
 * still burn a unit of someone else's quota, which is a denial-of-service
 * against the tenant paying for it.
 */

/**
 * The capability gate.
 *
 * Reads the stored value on every call, not only when units are supplied. That
 * ordering was the bug: the parse sat behind an early return for requests with
 * no `usageContext`, which is every request in production, so a row explicitly
 * set to `{ "enabled": false }` still granted access. A disabled entitlement now
 * denies whatever else the request looks like.
 */
export async function enforceEntitlement(
  tx: TenantTx,
  args: {
    tenantId: string;
    key?: string | null;
    requestId: string;
  },
): Promise<void> {
  if (!args.key) {
    return;
  }

  if (!args.tenantId) {
    throw new EntitlementRequiredError(args.key);
  }

  const entitlement = await findActiveEntitlementByKey(tx, args.key);

  if (!entitlement) {
    throw new EntitlementRequiredError(args.key);
  }

  // An unparseable value reads as disabled (see parseEntitlementValue), so
  // operator-editable JSON that fails validation closes the capability rather
  // than opening it.
  if (!parseEntitlementValue(entitlement.value).enabled) {
    throw new EntitlementRequiredError(args.key);
  }
}

/**
 * The meter.
 *
 * Advances the usage counter atomically and refuses the request if it would
 * cross the plan limit — see `entitlement-usage.repository.ts` for why that is a
 * single guarded statement rather than a read followed by a write.
 *
 * A limit of `null` means unmetered-but-enabled: the counter still advances, so
 * an operator who sets a limit later has history behind it rather than starting
 * every tenant from zero mid-period.
 */
export async function consumeEntitlementUnits(
  tx: TenantTx,
  args: {
    tenantId: string;
    key?: string | null;
    requestId: string;
    units: number;
  },
): Promise<void> {
  if (!args.key || !args.tenantId) {
    return;
  }

  // Zero, negative and non-finite unit counts are "nothing to meter" rather
  // than an error: a usage function that computes 0 bytes uploaded should let
  // the request through, not fail it.
  if (!Number.isFinite(args.units) || args.units <= 0) {
    return;
  }

  const entitlement = await findActiveEntitlementByKey(tx, args.key);

  // The gate runs first and would already have thrown. Re-checking here keeps
  // the function safe to call on its own.
  if (!entitlement) {
    throw new EntitlementRequiredError(args.key);
  }

  const value = parseEntitlementValue(entitlement.value);
  if (!value.enabled) {
    throw new EntitlementRequiredError(args.key);
  }

  const outcome = await consumeEntitlementUsage(tx, {
    tenantId: args.tenantId,
    entitlementKey: args.key,
    period: value.period,
    limit: value.limit,
    units: Math.floor(args.units),
  });

  if (!outcome.allowed) {
    throw new EntitlementLimitExceededError(args.key, outcome.used, outcome.limit, value.period);
  }
}
