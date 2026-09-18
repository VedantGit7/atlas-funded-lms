import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  decideModerationCaseBodySchema,
  decideModerationCaseResponseSchema,
  moderationCaseIdParamsSchema,
} from "../../../../../../../server/moderation/moderation.dto";
import { decideModerationCase } from "../../../../../../../server/moderation/moderation.service";
import { decideModerationCaseMetadata } from "../../../../../../../server/moderation/moderation.route-metadata";

type DecideModerationCaseBody = z.output<typeof decideModerationCaseBodySchema>;
type DecideModerationCaseResponse = z.output<typeof decideModerationCaseResponseSchema>;

export const POST = createTenantRoute<
  DecideModerationCaseBody,
  DecideModerationCaseResponse,
  typeof moderationCaseIdParamsSchema
>({
  metadata: decideModerationCaseMetadata,
  params: moderationCaseIdParamsSchema,
  body: decideModerationCaseBodySchema,
  output: decideModerationCaseResponseSchema,
  handler: async ({ tx, ctx, params, input }) => decideModerationCase(tx, ctx, params.id, input),
});
