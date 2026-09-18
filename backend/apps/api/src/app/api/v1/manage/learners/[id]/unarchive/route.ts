import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { manageLearnerArchiveResponseSchema } from "@atlas/api-server/manage/manage-learners.schemas";
import { manageLearnerArchiveMetadata } from "@atlas/api-server/manage/manage-learners.route-metadata";
import { unarchiveManageLearner } from "@atlas/api-server/manage/manage-learners.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof manageLearnerArchiveResponseSchema>,
  typeof paramsSchema
>({
  metadata: manageLearnerArchiveMetadata,
  params: paramsSchema,
  output: manageLearnerArchiveResponseSchema,
  handler: async ({ tx, ctx, params }) => unarchiveManageLearner(tx, ctx, params["id"]),
});
