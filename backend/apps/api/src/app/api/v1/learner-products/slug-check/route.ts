import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  learnerProductSlugCheckQuerySchema,
  learnerProductSlugCheckResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import { getLearnerProductMetadata } from "@atlas/domain/learner-products/learner-products.route-metadata";
import { checkLearnerProductSlug } from "@atlas/domain/learner-products/learner-products.service";

/**
 * Is a slug free for this product kind, and if not, which product holds it.
 *
 * A read on the catalogue the caller can already list, so it carries the same
 * `course.read` gate as the listing itself.
 */
export const GET = createTenantRoute<
  z.output<typeof learnerProductSlugCheckQuerySchema>,
  z.output<typeof learnerProductSlugCheckResponseSchema>
>({
  metadata: getLearnerProductMetadata,
  input: learnerProductSlugCheckQuerySchema,
  output: learnerProductSlugCheckResponseSchema,
  handler: async ({ tx, ctx, input }) => checkLearnerProductSlug(tx, ctx, input),
});
