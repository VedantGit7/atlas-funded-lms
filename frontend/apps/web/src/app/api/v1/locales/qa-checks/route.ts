import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  localeQaChecksResponseSchema,
  runLocaleQaChecksResponseSchema,
} from "../../../../../server/locales/locale.contract";
import { getLocaleQaChecks, runLocaleQaChecksForTenant } from "../../../../../server/locales/locale.service";
import {
  getLocaleQaChecksMetadata,
  runLocaleQaChecksMetadata,
} from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeQaChecksResponseSchema>
>({
  metadata: getLocaleQaChecksMetadata,
  output: localeQaChecksResponseSchema,
  handler: async ({ tx, ctx }) => getLocaleQaChecks(tx, ctx),
});

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof runLocaleQaChecksResponseSchema>
>({
  metadata: runLocaleQaChecksMetadata,
  output: runLocaleQaChecksResponseSchema,
  handler: async ({ tx, ctx }) => runLocaleQaChecksForTenant(tx, ctx),
});
