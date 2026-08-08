import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myActiveSeasonalEventResponseSchema } from "../../../../../../server/gamification/seasonal.schemas";
import { getMyActiveSeasonalEvent } from "../../../../../../server/gamification/seasonal.service";
import { routeMetadata } from "./route.metadata";

type MyActiveSeasonalEventResponse = z.output<typeof myActiveSeasonalEventResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MyActiveSeasonalEventResponse>({
  metadata: routeMetadata,
  output: myActiveSeasonalEventResponseSchema,
  handler: async ({ tx }) => getMyActiveSeasonalEvent(tx),
});
