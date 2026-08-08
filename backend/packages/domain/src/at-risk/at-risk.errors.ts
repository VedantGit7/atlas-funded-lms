import { AtlasHttpError } from "@atlas/core/http/errors";

export function atRiskAlertNotFound(alertId: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: `At-risk alert not found: ${alertId}`,
  });
}

export function atRiskRuleNotFound(ruleId: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: `At-risk rule not found: ${ruleId}`,
  });
}

export function atRiskAlertAlreadyAcknowledged(alertId: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: `At-risk alert already acknowledged: ${alertId}`,
  });
}
