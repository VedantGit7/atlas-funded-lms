const EXPECTED_ERROR_CODES = new Set([
  "TENANT_NOT_FOUND",
  "TENANT_UNAVAILABLE",
  "AUTH_REQUIRED",
  "NO_MEMBERSHIP",
  "MEMBERSHIP_PENDING",
  "MEMBERSHIP_SUSPENDED",
  "MEMBERSHIP_REMOVED",
  "INVALID_INVITATION",
  "INVITATION_EMAIL_MISMATCH",
  "ALREADY_MEMBER",
  "PERMISSION_DENIED",
  "PAYMENT_REQUIRED",
  "VALIDATION_ERROR",
]);

/**
 * A refusal the client caused, answered with a 4xx: not an error to report.
 * Any error that carries a 4xx status counts, whatever its code, so a new kind
 * of refusal doesn't become a Sentry issue. Missing entitlements and second
 * factors (ENTITLEMENT_REQUIRED, MFA_REQUIRED) and rate limits were reported
 * as errors because their codes weren't listed (Sentry ATLAS-LMS-5 and -H).
 * A 5xx, such as SERVICE_UNAVAILABLE, is still reported.
 */
export function isExpectedClientError(error: unknown): boolean {
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return error.status >= 400 && error.status < 500;
  }

  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return EXPECTED_ERROR_CODES.has(error.code);
  }

  if (error instanceof Error && error.name === "ZodError") {
    return true;
  }

  if (error instanceof Error && error.name === "PlatformScopeError") {
    return true;
  }

  return false;
}

export function isExpectedHttpStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}
