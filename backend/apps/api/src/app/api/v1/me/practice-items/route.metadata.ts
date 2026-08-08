import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadMyDeckCreateResourceRef } from "../../../../../server/decks/decks.service";
import type { PracticeItemsQuery } from "../../../../../server/decks/schemas";

export const routeMetadata = {
  // Self-scoped: browsing stems to curate into your own decks. This is not the
  // studio item bank (item.read), and no answer keys are exposed.
  permission: "practice_deck.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => await loadMyDeckCreateResourceRef({ ctx }),
} satisfies RouteMetadata<PracticeItemsQuery>;
