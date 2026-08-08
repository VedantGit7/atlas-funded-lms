import { AtlasHttpError } from "@atlas/core/http/errors";
import type { AuthorizationDecision } from "./types";

export function permissionDenied(decision?: AuthorizationDecision): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message:
      decision && !decision.allowed
        ? decision.safeMessage
        : "You do not have access to perform this action.",
  });
}

export function toAuthorizationError(decision: AuthorizationDecision): AtlasHttpError {
  if (decision.allowed) {
    throw new Error("Cannot convert allowed authorization decision to error");
  }

  return permissionDenied(decision);
}
