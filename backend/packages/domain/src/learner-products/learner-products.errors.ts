import { AtlasHttpError } from "@atlas/core/http/errors";

export function mockTestNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Mock test not found.",
  });
}

export function testSeriesNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Test series not found.",
  });
}

export function bundleNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Bundle not found.",
  });
}

export function learnerSubscriptionPlanNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Learner subscription plan not found.",
  });
}

export function duplicateLearnerProductSlug(productLabel: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: `${productLabel} slug already exists.`,
  });
}
