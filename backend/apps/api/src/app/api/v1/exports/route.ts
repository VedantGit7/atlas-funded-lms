import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createExportResponseSchema,
  exportListQuerySchema,
  exportListResponseSchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import { createExportJob, listExportJobs } from "@atlas/domain/data-rights/data-rights.service";
import {
  createExportMetadata,
  listExportsMetadata,
} from "@atlas/domain/data-rights/data-rights.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof exportListQuerySchema>,
  z.output<typeof exportListResponseSchema>
>({
  metadata: listExportsMetadata,
  input: exportListQuerySchema,
  output: exportListResponseSchema,
  handler: async ({ tx, ctx, input }) => listExportJobs(tx, ctx, input),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof createExportResponseSchema>
>({
  metadata: createExportMetadata,
  output: createExportResponseSchema,
  handler: async ({ tx, ctx }) => createExportJob(tx, ctx),
});
