import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { confirmModuleScormPackageUploadService } from "../../../../../../../server/courses/module-scorm.service";
import {
  moduleScormPackageConfirmBodySchema,
  studioModuleResponseSchema,
} from "../../../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { postRouteMetadata } from "./route.metadata";

type ModuleScormPackageConfirmBody = z.output<typeof moduleScormPackageConfirmBodySchema>;
type StudioModuleResponse = z.output<typeof studioModuleResponseSchema>;

export const POST = createTenantRoute<
  ModuleScormPackageConfirmBody,
  StudioModuleResponse,
  typeof uuidParamSchema
>({
  metadata: postRouteMetadata,
  params: uuidParamSchema,
  body: moduleScormPackageConfirmBodySchema,
  output: studioModuleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await confirmModuleScormPackageUploadService(tx, ctx, moduleId, input);
  },
});
