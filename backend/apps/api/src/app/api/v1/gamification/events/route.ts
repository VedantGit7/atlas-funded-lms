import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { gamificationEventsResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { listGamificationEvents } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type GamificationEventsResponse = z.output<typeof gamificationEventsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, GamificationEventsResponse>({
  metadata: routeMetadata,
  output: gamificationEventsResponseSchema,
  handler: () => Promise.resolve(listGamificationEvents()),
});
