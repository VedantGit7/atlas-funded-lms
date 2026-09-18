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

/**
 * A contents edit that points at something that is not there.
 *
 * Reported rather than silently stored: `insertBundle` accepts any `refId`,
 * which is how a catalogue accumulates items pointing at deleted courses. The
 * offending ids are named so the operator can see which row to fix.
 */
export function unknownLearnerProductReferences(refIds: string[]): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 422,
    message: `These items do not exist in this school: ${refIds.join(", ")}.`,
  });
}

/**
 * Somebody else saved this product's contents first.
 *
 * 409 rather than a silent overwrite: the losing save is a complete ordered
 * list, so applying it would erase the other operator's work with no trace.
 * The client reloads and the operator decides what to keep.
 *
 * `VALIDATION_ERROR` at 409 follows `duplicateLearnerProductSlug` above —
 * `AtlasErrorCode` has no generic conflict member, and the client distinguishes
 * this from a bad body by the status, which is the same signal it already uses
 * for a duplicate slug.
 */
export function learnerProductContentsConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "These contents changed since you opened them. Reload and reapply your changes.",
  });
}
