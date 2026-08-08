import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  addItemToMyDeck,
  listMyDeckItems,
  removeItemFromMyDeck,
} from "../../../../../../../server/decks/decks.service";
import {
  addDeckItemBodySchema,
  deckIdParamsSchema,
  deckItemQuerySchema,
  deckResponseSchema,
  practiceItemsResponseSchema,
} from "../../../../../../../server/decks/schemas";
import {
  deleteDeckItemRouteMetadata,
  getDeckItemsRouteMetadata,
  postDeckItemRouteMetadata,
} from "./route.metadata";

type AddDeckItemBody = z.output<typeof addDeckItemBodySchema>;
type DeckItemQuery = z.output<typeof deckItemQuerySchema>;
type DeckResponse = z.output<typeof deckResponseSchema>;
type DeckItemsResponse = z.output<typeof practiceItemsResponseSchema>;

export const GET = createTenantRoute<undefined, DeckItemsResponse, typeof deckIdParamsSchema>({
  metadata: getDeckItemsRouteMetadata,
  params: deckIdParamsSchema,
  output: practiceItemsResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const deckId = params["id"];
    if (!deckId) throw new Error("Missing deck id");
    return await listMyDeckItems(tx, ctx, deckId);
  },
});

export const POST = createTenantRoute<AddDeckItemBody, DeckResponse, typeof deckIdParamsSchema>({
  metadata: postDeckItemRouteMetadata,
  params: deckIdParamsSchema,
  body: addDeckItemBodySchema,
  output: deckResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const deckId = params["id"];
    if (!deckId) throw new Error("Missing deck id");
    return await addItemToMyDeck(tx, ctx, deckId, input);
  },
});

export const DELETE = createTenantRoute<DeckItemQuery, DeckResponse, typeof deckIdParamsSchema>({
  metadata: deleteDeckItemRouteMetadata,
  params: deckIdParamsSchema,
  input: deckItemQuerySchema,
  output: deckResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const deckId = params["id"];
    if (!deckId) throw new Error("Missing deck id");
    return await removeItemFromMyDeck(tx, ctx, deckId, input);
  },
});
