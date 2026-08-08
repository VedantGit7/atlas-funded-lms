import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { getModuleScormLaunchForLearner } from "../../../../../../server/courses/module-scorm-learner.service";
import { moduleScormLaunchResponseSchema } from "../../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { getRouteMetadata } from "./route.metadata";

type ModuleScormLaunchResponse = z.output<typeof moduleScormLaunchResponseSchema>;

export const GET = createTenantRoute<
  z.output<typeof noBodySchema>,
  ModuleScormLaunchResponse,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: noBodySchema,
  output: moduleScormLaunchResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await getModuleScormLaunchForLearner(tx, ctx, moduleId);
  },
});
