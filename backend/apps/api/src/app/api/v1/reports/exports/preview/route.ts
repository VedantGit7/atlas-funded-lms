import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportBuilderPreviewBodySchema,
  exportBuilderPreviewResponseSchema,
} from "@atlas/domain/reports/export-builder.dto";
import { previewExportBuilder } from "@atlas/domain/reports/export-builder.service";
import { previewExportBuilderMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof exportBuilderPreviewBodySchema>,
  z.output<typeof exportBuilderPreviewResponseSchema>
>({
  metadata: previewExportBuilderMetadata,
  input: exportBuilderPreviewBodySchema,
  output: exportBuilderPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => previewExportBuilder(tx, ctx, input),
});
