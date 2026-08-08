import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createProductCopyJobBodySchema,
  productCopyJobListResponseSchema,
  productCopyJobResponseSchema,
} from "@atlas/domain/sub-schools/product-copy.dto";
import {
  createProductCopyJob,
  listProductCopyJobs,
} from "@atlas/domain/sub-schools/product-copy.service";
import {
  createProductCopyJobMetadata,
  listProductCopyJobsMetadata,
} from "@atlas/domain/sub-schools/sub-schools.route-metadata";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof productCopyJobListResponseSchema>,
  typeof paramsSchema
>({
  metadata: listProductCopyJobsMetadata,
  params: paramsSchema,
  output: productCopyJobListResponseSchema,
  handler: async ({ tx, ctx, params }) => listProductCopyJobs(tx, ctx, params.id),
});

export const POST = createTenantRoute<
  z.output<typeof createProductCopyJobBodySchema>,
  z.output<typeof productCopyJobResponseSchema>,
  typeof paramsSchema
>({
  metadata: createProductCopyJobMetadata,
  params: paramsSchema,
  body: createProductCopyJobBodySchema,
  output: productCopyJobResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    createProductCopyJob(tx, ctx, params.id, input),
});
