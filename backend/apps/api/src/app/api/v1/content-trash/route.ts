import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  contentTrashActionBodySchema,
  contentTrashActionResponseSchema,
  contentTrashListQuerySchema,
  contentTrashListResponseSchema,
} from "../../../../server/content-trash/content-trash.contract";
import {
  listContentTrash,
  restoreContentTrash,
} from "../../../../server/content-trash/content-trash.service";
import { getRouteMetadata, postRestoreRouteMetadata } from "./route.metadata";

type ListResponse = z.output<typeof contentTrashListResponseSchema>;
type ActionBody = z.output<typeof contentTrashActionBodySchema>;
type ActionResponse = z.output<typeof contentTrashActionResponseSchema>;

export const GET = createTenantRoute<z.output<typeof contentTrashListQuerySchema>, ListResponse>({
  metadata: getRouteMetadata,
  input: contentTrashListQuerySchema,
  output: contentTrashListResponseSchema,
  handler: async ({ tx, input }) => listContentTrash(tx, input.kind),
});

export const POST = createTenantRoute<ActionBody, ActionResponse>({
  metadata: postRestoreRouteMetadata,
  body: contentTrashActionBodySchema,
  output: contentTrashActionResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    restoreContentTrash(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      input,
    ),
});
