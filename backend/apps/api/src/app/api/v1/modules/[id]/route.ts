import type { z } from "zod";
import { z as zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteCourseModule,
  updateCourseModule,
} from "../../../../../server/courses/course-authoring.service";
import {
  studioModuleResponseSchema,
  updateModuleBodySchema,
} from "../../../../../server/courses/schemas";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { deleteRouteMetadata, putRouteMetadata } from "./route.metadata";

type UpdateModuleBody = z.output<typeof updateModuleBodySchema>;
type StudioModuleResponse = z.output<typeof studioModuleResponseSchema>;

const deleteModuleResponseSchema = zod.object({
  data: zod.object({
    id: zod.string().uuid(),
    deleted: zod.literal(true),
  }),
});

export const PUT = createTenantRoute<
  UpdateModuleBody,
  StudioModuleResponse,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: updateModuleBodySchema,
  output: studioModuleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await updateCourseModule(tx, ctx, moduleId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteModuleResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  output: deleteModuleResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");
    return await deleteCourseModule(tx, ctx, moduleId);
  },
});
