import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteSubSchoolResponseSchema,
  subSchoolResponseSchema,
  updateSubSchoolBodySchema,
} from "@atlas/domain/sub-schools/sub-schools.dto";
import {
  deleteSubSchoolMetadata,
  getSubSchoolMetadata,
  updateSubSchoolMetadata,
} from "@atlas/domain/sub-schools/sub-schools.route-metadata";
import {
  deleteSubSchool,
  getSubSchool,
  updateSubSchool,
} from "@atlas/domain/sub-schools/sub-schools.service";
import { z as zod } from "zod";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof subSchoolResponseSchema>,
  typeof paramsSchema
>({
  metadata: getSubSchoolMetadata,
  params: paramsSchema,
  output: subSchoolResponseSchema,
  handler: async ({ tx, ctx, params }) => getSubSchool(tx, ctx, params["id"]),
});

export const PATCH = createTenantRoute<
  z.output<typeof updateSubSchoolBodySchema>,
  z.output<typeof subSchoolResponseSchema>,
  typeof paramsSchema
>({
  metadata: updateSubSchoolMetadata,
  params: paramsSchema,
  body: updateSubSchoolBodySchema,
  output: subSchoolResponseSchema,
  handler: async ({ tx, ctx, params, input }) => updateSubSchool(tx, ctx, params["id"], input),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteSubSchoolResponseSchema>,
  typeof paramsSchema
>({
  metadata: deleteSubSchoolMetadata,
  params: paramsSchema,
  output: deleteSubSchoolResponseSchema,
  handler: async ({ tx, ctx, params }) => deleteSubSchool(tx, ctx, params["id"]),
});
