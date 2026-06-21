import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createReactionBodySchema,
  deleteReactionBodySchema,
  reactionResponseSchema,
} from "../../../../server/community/community.dto";
import { createReaction, deleteReaction } from "../../../../server/community/community.service";
import {
  createReactionMetadata,
  deleteReactionMetadata,
} from "../../../../server/community/community.route-metadata";

export const POST = createTenantRoute<
  z.output<typeof createReactionBodySchema>,
  z.output<typeof reactionResponseSchema>
>({
  metadata: createReactionMetadata,
  body: createReactionBodySchema,
  output: reactionResponseSchema,
  handler: async ({ tx, ctx, input }) => createReaction(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteReactionBodySchema>,
  z.output<typeof reactionResponseSchema>
>({
  metadata: deleteReactionMetadata,
  body: deleteReactionBodySchema,
  output: reactionResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteReaction(tx, ctx, input),
});
