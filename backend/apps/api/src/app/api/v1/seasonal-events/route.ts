import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  postSeasonalEventsBodySchema,
  seasonalEventDetailResponseSchema,
  seasonalEventsListResponseSchema,
  updateSeasonalEventBodySchema,
} from "../../../../server/gamification/seasonal.schemas";
import {
  listSeasonalEvents,
  mutateSeasonalEvents,
  updateSeasonalEvent,
} from "../../../../server/gamification/seasonal.service";
import { getRouteMetadata, postRouteMetadata, putRouteMetadata } from "./route.metadata";

type SeasonalEventsListResponse = z.output<typeof seasonalEventsListResponseSchema>;
type SeasonalEventDetailResponse = z.output<typeof seasonalEventDetailResponseSchema>;
type PostSeasonalEventsBody = z.output<typeof postSeasonalEventsBodySchema>;
type UpdateSeasonalEventBody = z.output<typeof updateSeasonalEventBodySchema>;

export const GET = createTenantRoute<Record<string, never>, SeasonalEventsListResponse>({
  metadata: getRouteMetadata,
  output: seasonalEventsListResponseSchema,
  handler: async ({ tx }) => listSeasonalEvents(tx),
});

export const POST = createTenantRoute<PostSeasonalEventsBody, SeasonalEventDetailResponse>({
  metadata: postRouteMetadata,
  body: postSeasonalEventsBodySchema,
  output: seasonalEventDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => mutateSeasonalEvents(tx, ctx, input),
});

export const PUT = createTenantRoute<UpdateSeasonalEventBody, SeasonalEventDetailResponse>({
  metadata: putRouteMetadata,
  body: updateSeasonalEventBodySchema,
  output: seasonalEventDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateSeasonalEvent(tx, ctx, input),
});
