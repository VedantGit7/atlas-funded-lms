import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeResourceListResponseSchema } from "../../../../server/locales/locale.contract";
import { listLocaleResources } from "../../../../server/locales/locale.service";
import { listLocaleResourcesMetadata } from "../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeResourceListResponseSchema>
>({
  metadata: listLocaleResourcesMetadata,
  output: localeResourceListResponseSchema,
  handler: async ({ tx, ctx }) => listLocaleResources(tx, ctx),
});
