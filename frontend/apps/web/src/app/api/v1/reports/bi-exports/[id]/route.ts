import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { biExportDetailResponseSchema } from "@atlas/domain/reports/bi-export.dto";
import { getBiExportJob } from "@atlas/domain/reports/bi-export.service";
import { getBiExportMetadata } from "@atlas/domain/reports/reports.route-metadata";

const paramsSchema = z.object({ id: z.string().uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof biExportDetailResponseSchema>,
  typeof paramsSchema
>({
  metadata: getBiExportMetadata,
  params: paramsSchema,
  output: biExportDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getBiExportJob(tx, ctx, params.id),
});
