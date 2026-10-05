import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadMyDeckCreateResourceRef } from "../../../../../server/decks/decks.service";

export const getMyDecksRouteMetadata = {
  permission: "practice_deck.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => await loadMyDeckCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const postMyDeckRouteMetadata = {
  permission: "practice_deck.manage",
  entitlement: null,
  audit: "none",
  auditExempt: "learner_activity",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => await loadMyDeckCreateResourceRef({ ctx }),
} satisfies RouteMetadata;

export const routeMetadata = getMyDecksRouteMetadata;
