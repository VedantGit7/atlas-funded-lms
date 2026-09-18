export class EntitlementRequiredError extends Error {
  readonly code = "ENTITLEMENT_REQUIRED";
  readonly status = 403;

  constructor(readonly entitlementKey: string) {
    super(`Entitlement required: ${entitlementKey}`);
    this.name = "EntitlementRequiredError";
  }
}

/**
 * The tenant holds the entitlement but has consumed its allowance (M11).
 *
 * Distinct from EntitlementRequiredError because the remedy differs: a missing
 * entitlement needs a plan that includes the capability, whereas an exhausted
 * one needs a higher limit or the next period. 402 rather than 403 says the
 * same thing to a client — this is a billing state, not an authorization one.
 */
export class EntitlementLimitExceededError extends Error {
  readonly code = "ENTITLEMENT_LIMIT_EXCEEDED";
  readonly status = 402;

  constructor(
    readonly entitlementKey: string,
    readonly used: number,
    readonly limit: number,
    readonly period: string,
  ) {
    super(`Entitlement limit reached for ${entitlementKey}: ${used}/${limit} per ${period}`);
    this.name = "EntitlementLimitExceededError";
  }
}
