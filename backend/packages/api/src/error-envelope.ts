import { toSafeErrorEnvelope as toCoreSafeErrorEnvelope } from "@atlas/core/http/errors";
import { EntitlementRequiredError, STORAGE_ERROR_CODES } from "./errors";

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
