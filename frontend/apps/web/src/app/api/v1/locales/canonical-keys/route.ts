import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeCanonicalKeyListResponseSchema } from "../../../../../server/locales/locale.contract";
import { listLocaleCanonicalKeys } from "../../../../../server/locales/locale.service";
import { listLocaleCanonicalKeysMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeCanonicalKeyListResponseSchema>
>({
  metadata: listLocaleCanonicalKeysMetadata,
  output: localeCanonicalKeyListResponseSchema,
  handler: async ({ tx, ctx }) => listLocaleCanonicalKeys(tx, ctx),
});
