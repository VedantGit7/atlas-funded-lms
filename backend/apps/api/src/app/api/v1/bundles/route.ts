import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  bundleListResponseSchema,
  bundleResponseSchema,
  createBundleBodySchema,
  learnerProductListQuerySchema,
} from "@atlas/domain/learner-products/learner-products.dto";
import {
  createBundleMetadata,
  listBundlesMetadata,
} from "@atlas/domain/learner-products/learner-products.route-metadata";
import { createBundle, listBundles } from "@atlas/domain/learner-products/learner-products.service";

export const GET = createTenantRoute<
  z.output<typeof learnerProductListQuerySchema>,
  z.output<typeof bundleListResponseSchema>
>({
  metadata: listBundlesMetadata,
  input: learnerProductListQuerySchema,
  output: bundleListResponseSchema,
  handler: async ({ tx, ctx, input }) => listBundles(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createBundleBodySchema>,
  z.output<typeof bundleResponseSchema>
>({
  metadata: createBundleMetadata,
  body: createBundleBodySchema,
  output: bundleResponseSchema,
  handler: async ({ tx, ctx, input }) => createBundle(tx, ctx, input),
});
