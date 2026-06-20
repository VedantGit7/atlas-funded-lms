import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  DueQueueQuerySchema,
  dueQueueResponseSchema,
} from "../../../../../../server/practice/practice.schemas";
import { getDueQueue } from "../../../../../../server/practice/practice.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  z.output<typeof DueQueueQuerySchema>,
  z.output<typeof dueQueueResponseSchema>
>({
  metadata: routeMetadata,
  input: DueQueueQuerySchema,
  output: dueQueueResponseSchema,
  handler: async ({ tx, ctx, input }) => getDueQueue(tx, ctx, input),
});
