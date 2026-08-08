import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myActivityResponseSchema } from "../../../../../server/gamification/gamification.schemas";
import { getMyActivity } from "../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type MyActivityResponse = z.output<typeof myActivityResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MyActivityResponse>({
  metadata: routeMetadata,
  output: myActivityResponseSchema,
  handler: async ({ tx, ctx }) => getMyActivity(tx, ctx),
});
