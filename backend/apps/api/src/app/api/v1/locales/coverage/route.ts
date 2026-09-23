import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeCoverageResponseSchema } from "../../../../../server/locales/locale.contract";
import { getLocaleCoverage } from "../../../../../server/locales/locale.service";
import { getLocaleCoverageMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeCoverageResponseSchema>
>({
  metadata: getLocaleCoverageMetadata,
  output: localeCoverageResponseSchema,
  handler: async ({ tx, ctx }) => getLocaleCoverage(tx, ctx),
});
