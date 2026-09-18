import { toSafeErrorEnvelope as toCoreSafeErrorEnvelope } from "@atlas/core/http/errors";
import {
  EntitlementLimitExceededError,
  EntitlementRequiredError,
  STORAGE_ERROR_CODES,
} from "./errors";

const STORAGE_VALIDATION_MESSAGES: Partial<Record<string, string>> = {
  [STORAGE_ERROR_CODES.UNSUPPORTED_BRANDING_ASSET_TYPE]:
    "Unsupported branding asset type. Use PNG, JPEG, WebP, SVG, or ICO.",
  [STORAGE_ERROR_CODES.UNSUPPORTED_LESSON_ASSET_TYPE]: "Unsupported lesson asset type.",
  [STORAGE_ERROR_CODES.ASSET_SIZE_LIMIT_EXCEEDED]: "File exceeds the maximum allowed upload size.",
  [STORAGE_ERROR_CODES.SELF_HOSTED_VIDEO_FORBIDDEN]: "Self-hosted video uploads are not allowed.",
};

export function toSafeErrorEnvelope(error: unknown, requestId: string) {
  if (error instanceof EntitlementRequiredError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: "This feature is not enabled for this tenant.",
          requestId,
        },
      },
    };
  }

  /**
   * An exhausted plan allowance (M11).
   *
   * Without this branch the error is not an AtlasHttpError, so it fell through
   * to the catch-all and every metered route reported a reached limit as a 500
   * "Internal server error" — a billing state presented as a server fault, which
   * a client cannot act on and an operator would triage as an outage.
   *
   * The figures are the tenant's own plan data, so they are safe to return and
   * are what makes the response actionable: "47/50 this month" tells a client
   * to wait for the period or ask for a higher limit.
   */
  if (error instanceof EntitlementLimitExceededError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: `Plan limit reached: ${error.used} of ${error.limit} per ${error.period}.`,
          requestId,
        },
      },
    };
  }

  if (error instanceof Error) {
    const storageMessage = STORAGE_VALIDATION_MESSAGES[error.message];
    if (storageMessage) {
      return {
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: storageMessage,
            requestId,
          },
        },
      };
    }
  }

  return toCoreSafeErrorEnvelope(error, requestId);
}
