export class EntitlementRequiredError extends Error {
  readonly code = "ENTITLEMENT_REQUIRED";
  readonly status = 403;

  constructor(readonly entitlementKey: string) {
    super(`Entitlement required: ${entitlementKey}`);
    this.name = "EntitlementRequiredError";
  }
}
