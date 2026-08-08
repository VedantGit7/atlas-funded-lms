import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  postQuestsBodySchema,
  questAdminListResponseSchema,
  questDetailResponseSchema,
  updateQuestBodySchema,
} from "../../../../server/gamification/quest.schemas";
import {
  listQuestsForAdmin,
  mutateQuests,
  updateQuest,
} from "../../../../server/gamification/quest.service";
import { getRouteMetadata, postRouteMetadata, putRouteMetadata } from "./route.metadata";

type QuestAdminListResponse = z.output<typeof questAdminListResponseSchema>;
type QuestDetailResponse = z.output<typeof questDetailResponseSchema>;
type PostQuestsBody = z.output<typeof postQuestsBodySchema>;
type UpdateQuestBody = z.output<typeof updateQuestBodySchema>;

export const GET = createTenantRoute<Record<string, never>, QuestAdminListResponse>({
  metadata: getRouteMetadata,
  output: questAdminListResponseSchema,
  handler: async ({ tx }) => listQuestsForAdmin(tx),
});

export const POST = createTenantRoute<PostQuestsBody, QuestDetailResponse>({
  metadata: postRouteMetadata,
  body: postQuestsBodySchema,
  output: questDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => mutateQuests(tx, ctx, input),
});

export const PUT = createTenantRoute<UpdateQuestBody, QuestDetailResponse>({
  metadata: putRouteMetadata,
  body: updateQuestBodySchema,
  output: questDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateQuest(tx, ctx, input),
});
