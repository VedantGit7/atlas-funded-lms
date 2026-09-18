import { AtlasHttpError } from "@atlas/core/http/errors";

export function tagNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Tag not found.",
  });
}

/**
 * Another live tag already derives this slug.
 *
 * 409 with `VALIDATION_ERROR` follows the convention the rest of this codebase
 * uses for a uniqueness clash — `AtlasErrorCode` has no `CONFLICT` member, and
 * widening a core union for one screen is the wrong trade. The existing tag is
 * named because the slug is derived: the admin may have typed a title that
 * looks nothing like the one already holding it.
 */
export function tagSlugTaken(existingTitle: string, slug: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: `“${existingTitle}” already uses the slug ${slug}. Choose a different title.`,
  });
}

/**
 * A merge named its own survivor as a source.
 *
 * Guarded in the service and not only in the request schema, because the
 * failure is destructive rather than merely invalid: repointing a tag onto
 * itself is a no-op, and the delete that follows would then remove the one tag
 * the merge was supposed to keep — leaving the operator with the whole cluster
 * gone and nothing to show for it.
 */
export function tagCannotMergeIntoItself(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "A tag cannot be merged into itself.",
  });
}
