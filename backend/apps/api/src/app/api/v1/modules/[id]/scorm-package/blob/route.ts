import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { storeModuleScormPackageBlobService } from "../../../../../../../server/courses/module-scorm.service";
import { moduleScormPackageBlobBodySchema } from "../../../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postRouteMetadata } from "../upload/route.metadata";

type ModuleScormPackageBlobBody = z.output<typeof moduleScormPackageBlobBodySchema>;

const blobResponseSchema = z.object({
  data: z.object({
    assetReferenceId: z.uuid(),
    stored: z.literal(true),
  }),
});

export const POST = createTenantRoute<
  ModuleScormPackageBlobBody,
  z.output<typeof blobResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: moduleScormPackageBlobBodySchema,
  output: blobResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await storeModuleScormPackageBlobService(tx, ctx, moduleId, input);
  },
});
