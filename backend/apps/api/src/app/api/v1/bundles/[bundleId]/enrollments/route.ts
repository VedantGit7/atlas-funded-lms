import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  bundleParamsSchema,
  productEnrollBodySchema,
  productEnrollmentListQuerySchema,
  productEnrollmentListResponseSchema,
  productEnrollmentResponseSchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  enrollBundleMetadata,
  listProductEnrollmentsMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import {
  enrollBundle,
  listBundleEnrollments,
} from "@atlas/domain/learner-products/learner-products.service";

export const POST = createTenantRoute<
  z.output<typeof productEnrollBodySchema>,
  z.output<typeof productEnrollmentResponseSchema>,
  typeof bundleParamsSchema
>({
  metadata: enrollBundleMetadata,
  params: bundleParamsSchema,
  body: productEnrollBodySchema,
  output: productEnrollmentResponseSchema,
  handler: async ({ tx, ctx, params, input }) => enrollBundle(tx, ctx, params["bundleId"], input),
});

export const GET = createTenantRoute<
  z.output<typeof productEnrollmentListQuerySchema>,
  z.output<typeof productEnrollmentListResponseSchema>,
  typeof bundleParamsSchema
>({
  metadata: listProductEnrollmentsMetadata,
  params: bundleParamsSchema,
  input: productEnrollmentListQuerySchema,
  output: productEnrollmentListResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    listBundleEnrollments(tx, ctx, params["bundleId"], input),
});
