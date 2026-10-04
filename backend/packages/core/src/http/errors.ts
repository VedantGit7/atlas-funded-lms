export type AtlasErrorCode =
  | "TENANT_NOT_FOUND"
  | "TENANT_DOMAIN_INACTIVE"
  | "TENANT_UNAVAILABLE"
  | "AUTH_REQUIRED"
  // Audit finding H6. Each needs a different next step from the person signing
  // in, so none of them collapses into AUTH_REQUIRED: a disabled account must
  // contact support, an unverified email must open the verification link, and
  // a re-registered email waits for a platform operator to review the link.
  | "ACCOUNT_DISABLED"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_REVIEW_REQUIRED"
  | "NO_MEMBERSHIP"
  | "MEMBERSHIP_PENDING"
  | "MEMBERSHIP_SUSPENDED"
  | "MEMBERSHIP_REMOVED"
  | "INVALID_INVITATION"
  | "INVITATION_EMAIL_MISMATCH"
  | "PERMISSION_DENIED"
  // 403, but distinct from PERMISSION_DENIED: the caller has the permission and
  // is missing a second factor, so the client can offer enrolment instead of a
  // dead-end "you do not have access". Same reasoning as RATE_LIMITED below
  // (audit finding H5).
  | "MFA_REQUIRED"
  | "PAYMENT_REQUIRED"
  | "VALIDATION_ERROR"
  // 429. Distinct from INTERNAL_ERROR so clients can back off instead of
  // treating a throttle as a server fault (audit finding L4).
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  // 409. Distinct because the two idempotency conflicts need opposite client
  // responses: an in-flight duplicate should be retried with the same key,
  // while a key reused for a different request must never be retried at all.
  // Collapsing both into VALIDATION_ERROR would leave the client guessing
  // (audit finding M10).
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR";

export class AtlasHttpError extends Error {
  readonly code: AtlasErrorCode;
  readonly status: number;
  readonly expose: boolean;
  readonly retryAfterSeconds?: number;

  constructor(args: {
    code: AtlasErrorCode;
    status: number;
    message: string;
    expose?: boolean;
    retryAfterSeconds?: number;
  }) {
    super(args.message);
    this.name = "AtlasHttpError";
    this.code = args.code;
    this.status = args.status;
    this.expose = args.expose ?? true;
    if (
      args.retryAfterSeconds !== undefined &&
      Number.isSafeInteger(args.retryAfterSeconds) &&
      args.retryAfterSeconds > 0
    )
      this.retryAfterSeconds = args.retryAfterSeconds;
  }
}

function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

export function toSafeErrorEnvelope(
  error: unknown,
  requestId: string,
): {
  status: number;
  headers?: Record<string, string>;
  body: { error: { code: string; message: string; requestId: string } };
} {
  if (isValidationError(error)) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR" as const,
          message: "Invalid request",
          requestId,
        },
      },
    };
  }

  if (error instanceof AtlasHttpError) {
    return {
      status: error.status,
      ...(error.retryAfterSeconds
        ? { headers: { "Retry-After": String(error.retryAfterSeconds) } }
        : {}),
      body: {
        error: {
          code: error.code,
          message: error.expose ? error.message : "Request failed",
          requestId,
        },
      },
    };
  }

  if (error instanceof Error && error.message === "THEME_CONTRAST_FAILED") {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR" as const,
          message: "Theme colors do not meet contrast requirements",
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId,
      },
    },
  };
}
