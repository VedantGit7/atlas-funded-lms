import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  biExportListQuerySchema,
  biExportListResponseSchema,
  createBiExportBodySchema,
  createBiExportResponseSchema,
} from "@atlas/domain/reports/bi-export.dto";
import { createBiExportJob, listBiExportJobs } from "@atlas/domain/reports/bi-export.service";
import {
  createBiExportMetadata,
  listBiExportMetadata,
} from "@atlas/domain/reports/reports.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof biExportListQuerySchema>,
  z.output<typeof biExportListResponseSchema>
>({
  metadata: listBiExportMetadata,
  input: biExportListQuerySchema,
  output: biExportListResponseSchema,
  handler: async ({ tx, ctx, input }) => listBiExportJobs(tx, ctx, input),
});

export const POST = createTenantRoute<
  z.output<typeof createBiExportBodySchema>,
  z.output<typeof createBiExportResponseSchema>
>({
  metadata: createBiExportMetadata,
  input: createBiExportBodySchema,
  output: createBiExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createBiExportJob(tx, ctx, input),
});
