import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  contentTrashActionBodySchema,
  contentTrashActionResponseSchema,
} from "../../../../../server/content-trash/content-trash.contract";
import { purgeContentTrash } from "../../../../../server/content-trash/content-trash.service";
import { postPurgeRouteMetadata } from "../route.metadata";

type ActionBody = z.output<typeof contentTrashActionBodySchema>;
type ActionResponse = z.output<typeof contentTrashActionResponseSchema>;

export const POST = createTenantRoute<ActionBody, ActionResponse>({
  metadata: postPurgeRouteMetadata,
  body: contentTrashActionBodySchema,
  output: contentTrashActionResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    purgeContentTrash(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        requestId: ctx.requestId,
      },
      input,
    ),
});
