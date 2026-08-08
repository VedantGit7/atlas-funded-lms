import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  getModuleScormProgressForLearner,
  recordModuleScormProgressForLearner,
} from "../../../../../../server/courses/module-scorm-learner.service";
import {
  moduleScormProgressBodySchema,
  moduleScormProgressResponseSchema,
} from "../../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type ModuleScormProgressBody = z.output<typeof moduleScormProgressBodySchema>;
type ModuleScormProgressResponse = z.output<typeof moduleScormProgressResponseSchema>;

export const GET = createTenantRoute<
  z.output<typeof noBodySchema>,
  ModuleScormProgressResponse,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  input: noBodySchema,
  output: moduleScormProgressResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await getModuleScormProgressForLearner(tx, ctx, moduleId);
  },
});

export const PUT = createTenantRoute<
  ModuleScormProgressBody,
  ModuleScormProgressResponse,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: moduleScormProgressBodySchema,
  output: moduleScormProgressResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await recordModuleScormProgressForLearner(tx, ctx, moduleId, input);
  },
});
