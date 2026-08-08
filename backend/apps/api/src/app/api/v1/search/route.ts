import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { searchListResponseSchema, searchQuerySchema } from "@atlas/domain/search/search.dto";
import { querySearch } from "@atlas/domain/search/search.service";
import { searchQueryMetadata } from "@atlas/domain/search/search.route-metadata";

export const GET = createTenantRoute<
  z.output<typeof searchQuerySchema>,
  z.output<typeof searchListResponseSchema>
>({
  metadata: searchQueryMetadata,
  input: searchQuerySchema,
  output: searchListResponseSchema,
  handler: async ({ tx, ctx, input }) => querySearch(tx, ctx, input),
});
