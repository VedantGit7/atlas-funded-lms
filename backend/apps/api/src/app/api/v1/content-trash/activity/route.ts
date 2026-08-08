import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  contentTrashActivityQuerySchema,
  contentTrashActivityResponseSchema,
} from "../../../../../server/content-trash/content-trash.contract";
import { listContentTrashActivity } from "../../../../../server/content-trash/content-trash.service";
import { getRouteMetadata } from "./route.metadata";

type Query = z.output<typeof contentTrashActivityQuerySchema>;
type Response = z.output<typeof contentTrashActivityResponseSchema>;

export const GET = createTenantRoute<Query, Response>({
  metadata: getRouteMetadata,
  input: contentTrashActivityQuerySchema,
  output: contentTrashActivityResponseSchema,
  handler: async ({ tx, input }) =>
    listContentTrashActivity(tx, {
      limit: input.limit,
      ...(input.q ? { q: input.q } : {}),
    }),
});
