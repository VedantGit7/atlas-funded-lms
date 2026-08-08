import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createSubSchoolBodySchema,
  subSchoolListResponseSchema,
  subSchoolResponseSchema,
} from "@atlas/domain/sub-schools/sub-schools.dto";
import {
  createSubSchoolMetadata,
  listSubSchoolsMetadata,
} from "@atlas/domain/sub-schools/sub-schools.route-metadata";
import { createSubSchool, listSubSchools } from "@atlas/domain/sub-schools/sub-schools.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof subSchoolListResponseSchema>
>({
  metadata: listSubSchoolsMetadata,
  output: subSchoolListResponseSchema,
  handler: async ({ tx, ctx }) => listSubSchools(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createSubSchoolBodySchema>,
  z.output<typeof subSchoolResponseSchema>
>({
  metadata: createSubSchoolMetadata,
  body: createSubSchoolBodySchema,
  output: subSchoolResponseSchema,
  handler: async ({ tx, ctx, input }) => createSubSchool(tx, ctx, input),
});
