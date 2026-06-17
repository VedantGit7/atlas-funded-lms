import { toSafeErrorEnvelope as toCoreSafeErrorEnvelope } from "@atlas/core/http/errors";
import { EntitlementRequiredError } from "./errors";

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

  return toCoreSafeErrorEnvelope(error, requestId);
}
