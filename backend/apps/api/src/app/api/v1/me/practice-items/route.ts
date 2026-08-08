import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listPracticeItemsService } from "../../../../../server/decks/decks.service";
import {
  practiceItemsQuerySchema,
  practiceItemsResponseSchema,
} from "../../../../../server/decks/schemas";
import { routeMetadata } from "./route.metadata";

type PracticeItemsQuery = z.output<typeof practiceItemsQuerySchema>;
type PracticeItemsResponse = z.output<typeof practiceItemsResponseSchema>;

export const GET = createTenantRoute<PracticeItemsQuery, PracticeItemsResponse>({
  metadata: routeMetadata,
  input: practiceItemsQuerySchema,
  output: practiceItemsResponseSchema,
  handler: async ({ tx, ctx, input }) => await listPracticeItemsService(tx, ctx, input),
});
