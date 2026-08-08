import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createMyDeck, listMyDecksService } from "../../../../../server/decks/decks.service";
import {
  createDeckBodySchema,
  deckResponseSchema,
  myDecksResponseSchema,
} from "../../../../../server/decks/schemas";
import { getMyDecksRouteMetadata, postMyDeckRouteMetadata } from "./route.metadata";

type CreateDeckBody = z.output<typeof createDeckBodySchema>;
type DeckResponse = z.output<typeof deckResponseSchema>;
type MyDecksResponse = z.output<typeof myDecksResponseSchema>;

export const GET = createTenantRoute<undefined, MyDecksResponse>({
  metadata: getMyDecksRouteMetadata,
  output: myDecksResponseSchema,
  handler: async ({ tx, ctx }) => await listMyDecksService(tx, ctx),
});

export const POST = createTenantRoute<CreateDeckBody, DeckResponse>({
  metadata: postMyDeckRouteMetadata,
  body: createDeckBodySchema,
  output: deckResponseSchema,
  handler: async ({ tx, ctx, input }) => await createMyDeck(tx, ctx, input),
});
