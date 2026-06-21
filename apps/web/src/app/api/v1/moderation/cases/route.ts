import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createModerationCaseBodySchema,
  createModerationCaseResponseSchema,
  moderationCaseListResponseSchema,
  moderationListQuerySchema,
} from "../../../../../server/moderation/moderation.dto";
import {
  createModerationCase,
  listModerationCases,
} from "../../../../../server/moderation/moderation.service";
import {
  createModerationCaseMetadata,
  listModerationCasesMetadata,
} from "../../../../../server/moderation/moderation.route-metadata";

type ModerationListQuery = z.output<typeof moderationListQuerySchema>;
type ModerationCaseListResponse = z.output<typeof moderationCaseListResponseSchema>;
type CreateModerationCaseBody = z.output<typeof createModerationCaseBodySchema>;
type CreateModerationCaseResponse = z.output<typeof createModerationCaseResponseSchema>;

export const GET = createTenantRoute<ModerationListQuery, ModerationCaseListResponse>({
  metadata: listModerationCasesMetadata,
  input: moderationListQuerySchema,
  output: moderationCaseListResponseSchema,
  handler: async ({ tx, ctx, input }) => listModerationCases(tx, ctx, input),
});

export const POST = createTenantRoute<CreateModerationCaseBody, CreateModerationCaseResponse>({
  metadata: createModerationCaseMetadata,
  body: createModerationCaseBodySchema,
  output: createModerationCaseResponseSchema,
  handler: async ({ tx, ctx, input }) => createModerationCase(tx, ctx, input),
});
