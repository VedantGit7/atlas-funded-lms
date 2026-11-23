import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { searchListResponseSchema, searchQuerySchema } from "@atlas/domain/search/search.dto";
// Not from the domain package directly: this module also loads the search
// sources, without which every result is dropped (QA review 1 C9).
import { querySearch } from "../../../../server/search/search-query";
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
