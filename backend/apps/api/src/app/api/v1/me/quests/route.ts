import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { myQuestsResponseSchema } from "../../../../../server/gamification/quest.schemas";
import { listMyQuests } from "../../../../../server/gamification/quest.service";
import { routeMetadata } from "./route.metadata";

type MyQuestsResponse = z.output<typeof myQuestsResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MyQuestsResponse>({
  metadata: routeMetadata,
  output: myQuestsResponseSchema,
  handler: async ({ tx, ctx }) => listMyQuests(tx, ctx),
});
