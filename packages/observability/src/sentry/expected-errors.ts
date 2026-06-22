const EXPECTED_ERROR_CODES = new Set([
  "TENANT_NOT_FOUND",
  "TENANT_DOMAIN_INACTIVE",
  "TENANT_UNAVAILABLE",
  "AUTH_REQUIRED",
  "NO_MEMBERSHIP",
  "MEMBERSHIP_PENDING",
  "MEMBERSHIP_SUSPENDED",
  "MEMBERSHIP_REMOVED",
  "INVALID_INVITATION",
  "PERMISSION_DENIED",
  "VALIDATION_ERROR",
]);

export function isExpectedClientError(error: unknown): boolean {
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
