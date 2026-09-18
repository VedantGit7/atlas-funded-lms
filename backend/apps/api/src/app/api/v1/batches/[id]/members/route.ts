import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  assignBatchMemberBodySchema,
  assignBatchMemberResponseSchema,
} from "@atlas/domain/batches/batches.dto";
import { assignBatchMemberMetadata } from "@atlas/domain/batches/batches.route-metadata";
import { assignBatchMember } from "@atlas/domain/batches/batches.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  z.output<typeof assignBatchMemberBodySchema>,
  z.output<typeof assignBatchMemberResponseSchema>,
  typeof paramsSchema
>({
  metadata: assignBatchMemberMetadata,
  params: paramsSchema,
  input: assignBatchMemberBodySchema,
  output: assignBatchMemberResponseSchema,
  handler: async ({ tx, ctx, params, input }) => assignBatchMember(tx, ctx, params["id"], input),
});
