import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  hallOfFameConfigResponseSchema,
  updateHallOfFameConfigBodySchema,
} from "../../../../../server/gamification/gamification.schemas";
import {
  getHallOfFameConfig,
  updateHallOfFameConfig,
} from "../../../../../server/gamification/gamification.service";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type HallOfFameConfigResponse = z.output<typeof hallOfFameConfigResponseSchema>;
type UpdateHallOfFameConfigBody = z.output<typeof updateHallOfFameConfigBodySchema>;

export const GET = createTenantRoute<Record<string, never>, HallOfFameConfigResponse>({
  metadata: getRouteMetadata,
  output: hallOfFameConfigResponseSchema,
  handler: async ({ tx }) => getHallOfFameConfig(tx),
});

export const PUT = createTenantRoute<UpdateHallOfFameConfigBody, HallOfFameConfigResponse>({
  metadata: putRouteMetadata,
  body: updateHallOfFameConfigBodySchema,
  output: hallOfFameConfigResponseSchema,
  handler: async ({ tx, ctx, input }) => updateHallOfFameConfig(tx, ctx, input),
});
