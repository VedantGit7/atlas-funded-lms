import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createAppealBodySchema,
  createAppealResponseSchema,
} from "../../../../server/moderation/moderation.dto";
import { createAppeal } from "../../../../server/moderation/moderation.service";
import { createAppealMetadata } from "../../../../server/moderation/moderation.route-metadata";

type CreateAppealBody = z.output<typeof createAppealBodySchema>;
type CreateAppealResponse = z.output<typeof createAppealResponseSchema>;

export const POST = createTenantRoute<CreateAppealBody, CreateAppealResponse>({
  metadata: createAppealMetadata,
  body: createAppealBodySchema,
  output: createAppealResponseSchema,
  handler: async ({ tx, ctx, input }) => createAppeal(tx, ctx, input),
});
