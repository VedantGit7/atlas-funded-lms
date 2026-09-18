import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { z } from "zod";
import { readPlatformDeadLetterList } from "@atlas/events";
import { DeadLetterListQuerySchema } from "@atlas/events/schemas/dead-letter-list";
import { routeMetadata } from "./route.metadata";

const querySchema = DeadLetterListQuerySchema.extend({
  reason: z.string().min(10),
});

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  query: querySchema,
  output: z.object({
    data: z.array(z.unknown()),
    page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
  }),
  handler: async ({ tx, query }) => {
    const { limit, cursor } = query;
    return readPlatformDeadLetterList(tx, { limit: limit, cursor });
  },
});
