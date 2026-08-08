import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { deleteMyDeck, renameMyDeck } from "../../../../../../server/decks/decks.service";
import {
  deckDeletedResponseSchema,
  deckIdParamsSchema,
  deckResponseSchema,
  updateDeckBodySchema,
} from "../../../../../../server/decks/schemas";
import { deleteMyDeckRouteMetadata, patchMyDeckRouteMetadata } from "./route.metadata";

type UpdateDeckBody = z.output<typeof updateDeckBodySchema>;
type DeckResponse = z.output<typeof deckResponseSchema>;
type DeckDeletedResponse = z.output<typeof deckDeletedResponseSchema>;

export const PATCH = createTenantRoute<UpdateDeckBody, DeckResponse, typeof deckIdParamsSchema>({
  metadata: patchMyDeckRouteMetadata,
  params: deckIdParamsSchema,
  body: updateDeckBodySchema,
  output: deckResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const deckId = params["id"];
    if (!deckId) throw new Error("Missing deck id");
    return await renameMyDeck(tx, ctx, deckId, input);
  },
});

export const DELETE = createTenantRoute<undefined, DeckDeletedResponse, typeof deckIdParamsSchema>({
  metadata: deleteMyDeckRouteMetadata,
  params: deckIdParamsSchema,
  output: deckDeletedResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const deckId = params["id"];
    if (!deckId) throw new Error("Missing deck id");
    return await deleteMyDeck(tx, ctx, deckId);
  },
});
