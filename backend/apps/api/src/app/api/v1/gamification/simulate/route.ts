import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  simulateBodySchema,
  simulateResponseSchema,
} from "../../../../../server/gamification/gamification.schemas";
import { simulateGamificationEvent } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type SimulateBody = z.output<typeof simulateBodySchema>;
type SimulateResponse = z.output<typeof simulateResponseSchema>;

export const POST = createTenantRoute<SimulateBody, SimulateResponse>({
  metadata: routeMetadata,
  body: simulateBodySchema,
  output: simulateResponseSchema,
  handler: async ({ tx, input }) => simulateGamificationEvent(tx, input),
});
