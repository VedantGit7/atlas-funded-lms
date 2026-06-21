import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { searchReindexResponseSchema } from "@atlas/domain/search/search.dto";
import { requestSearchReindex } from "@atlas/domain/search/search.service";
import { searchReindexMetadata } from "@atlas/domain/search/search.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof searchReindexResponseSchema>
>({
  metadata: searchReindexMetadata,
  output: searchReindexResponseSchema,
  handler: async ({ tx, ctx }) => requestSearchReindex(tx, ctx),
});
