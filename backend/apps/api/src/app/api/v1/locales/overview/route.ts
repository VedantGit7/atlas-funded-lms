import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeOverviewResponseSchema } from "../../../../../server/locales/locale.contract";
import { getLocaleOverview } from "../../../../../server/locales/locale.service";
import { getLocaleOverviewMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeOverviewResponseSchema>
>({
  metadata: getLocaleOverviewMetadata,
  output: localeOverviewResponseSchema,
  handler: async ({ tx, ctx }) => getLocaleOverview(tx, ctx),
});
