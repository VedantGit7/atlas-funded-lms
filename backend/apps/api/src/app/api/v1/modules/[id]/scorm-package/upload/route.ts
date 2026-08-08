import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { createModuleScormPackageUploadService } from "../../../../../../../server/courses/module-scorm.service";
import { moduleScormPackageUploadBodySchema } from "../../../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postRouteMetadata } from "./route.metadata";

type ModuleScormPackageUploadBody = z.output<typeof moduleScormPackageUploadBodySchema>;
type SignedUploadResponse = z.output<typeof SignedUploadResponseSchema>;

export const POST = createTenantRoute<
  ModuleScormPackageUploadBody,
  SignedUploadResponse,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: moduleScormPackageUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await createModuleScormPackageUploadService(tx, ctx, moduleId, input);
  },
});
