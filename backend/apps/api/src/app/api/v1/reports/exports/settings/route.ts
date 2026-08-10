import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  exportSettingsResponseSchema,
  updateExportSettingsBodySchema,
  updateExportSettingsResponseSchema,
} from "@atlas/domain/reports/export-settings.dto";
import {
  getExportSettingsMetadata,
  updateExportSettingsMetadata,
} from "@atlas/domain/reports/exports-roster.route-metadata";
import {
  getExportSettings,
  updateExportSettings,
} from "@atlas/domain/reports/export-settings.service";
import { rejectClientTenantFields } from "@atlas/domain/shared/domain.dto";

const emptyQuerySchema = rejectClientTenantFields.extend({}).strict();

export const GET = createTenantRoute<
  z.output<typeof emptyQuerySchema>,
  z.output<typeof exportSettingsResponseSchema>
>({
  metadata: getExportSettingsMetadata,
  input: emptyQuerySchema,
  output: exportSettingsResponseSchema,
  handler: async ({ tx, ctx }) => getExportSettings(tx, ctx),
});

export const PUT = createTenantRoute<
  z.output<typeof updateExportSettingsBodySchema>,
  z.output<typeof updateExportSettingsResponseSchema>
>({
  metadata: updateExportSettingsMetadata,
  input: updateExportSettingsBodySchema,
  output: updateExportSettingsResponseSchema,
  handler: async ({ tx, ctx, input }) => updateExportSettings(tx, ctx, input),
});
