import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportJobDetailResponseSchema,
  exportJobParamsSchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import { getExportJob } from "@atlas/domain/data-rights/data-rights.service";
import { getExportMetadata } from "@atlas/domain/data-rights/data-rights.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof exportJobDetailResponseSchema>,
  typeof exportJobParamsSchema
>({
  metadata: getExportMetadata,
  params: exportJobParamsSchema,
  output: exportJobDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => getExportJob(tx, ctx, params["id"] ?? ""),
});
