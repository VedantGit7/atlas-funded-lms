import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * A 404 phrased as a permission denial.
 *
 * RLS already scopes the lookup to the tenant, so "not found" and "belongs to
 * somebody else" are the same answer here — and they must stay the same answer,
 * or the id space becomes a way to probe for another academy's events.
 */
export function attributionEventNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Attribution event not found.",
  });
}
