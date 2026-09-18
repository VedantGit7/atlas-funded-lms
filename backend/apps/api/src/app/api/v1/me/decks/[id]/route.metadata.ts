import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadMyDeckResourceRef } from "../../../../../../server/decks/decks.service";

const deckResourceLoader = async ({
  tx,
  ctx,
  params,
}: Parameters<NonNullable<RouteMetadata["resourceLoader"]>>[0]) => {
  const deckId = params["id"];
  if (!deckId) throw new Error("Missing deck id");
  return await loadMyDeckResourceRef({ tx, ctx, deckId });
};

export const patchMyDeckRouteMetadata = {
  permission: "practice_deck.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: deckResourceLoader,
} satisfies RouteMetadata;

export const deleteMyDeckRouteMetadata = {
  permission: "practice_deck.manage",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "none",
  resourceLoader: deckResourceLoader,
} satisfies RouteMetadata;

export const routeMetadata = patchMyDeckRouteMetadata;
