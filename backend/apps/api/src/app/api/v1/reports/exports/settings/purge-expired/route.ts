import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  purgeExpiredBodySchema,
  purgeExpiredResponseSchema,
} from "@atlas/domain/reports/export-settings.dto";
import { purgeExpiredExportsMetadata } from "@atlas/domain/reports/exports-roster.route-metadata";
import { purgeExpiredExportFiles } from "@atlas/domain/reports/export-settings.service";

export const POST = createTenantRoute<
  z.output<typeof purgeExpiredBodySchema>,
  z.output<typeof purgeExpiredResponseSchema>
>({
  metadata: purgeExpiredExportsMetadata,
  input: purgeExpiredBodySchema,
  output: purgeExpiredResponseSchema,
  handler: async ({ tx, ctx }) => purgeExpiredExportFiles(tx, ctx),
});
