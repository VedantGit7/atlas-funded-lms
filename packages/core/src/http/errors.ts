export type AtlasErrorCode =
  | "TENANT_NOT_FOUND"
  | "TENANT_DOMAIN_INACTIVE"
  | "TENANT_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AtlasHttpError extends Error {
  readonly code: AtlasErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(args: { code: AtlasErrorCode; status: number; message: string; expose?: boolean }) {
    super(args.message);
    this.name = "AtlasHttpError";
    this.code = args.code;
    this.status = args.status;
    this.expose = args.expose ?? true;
  }
}

function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

export function toSafeErrorEnvelope(error: unknown, requestId: string) {
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
      body: {
        error: {
          code: error.code,
          message: error.expose ? error.message : "Request failed",
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
