import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { assignRoleBodySchema } from "@atlas/domain-access/schemas/access-admin";
import { assignRoleToMember } from "@atlas/domain-access";
import { z as zod } from "zod";
import { postRouteMetadata } from "./route.metadata";

const memberParamsSchema = zod.object({ id: zod.string().uuid() });

const assignRoleResponseSchema = zod.object({
  data: zod.object({
    membershipId: zod.string().uuid(),
    role: zod.object({
      id: zod.string().uuid(),
      key: zod.string(),
      name: zod.string(),
      isSystem: zod.boolean(),
    }),
  }),
});

type AssignRoleBody = z.output<typeof assignRoleBodySchema>;
type AssignRoleResponse = z.output<typeof assignRoleResponseSchema>;

export const POST = createTenantRoute<AssignRoleBody, AssignRoleResponse>({
  metadata: postRouteMetadata,
  params: memberParamsSchema,
  body: assignRoleBodySchema,
  output: assignRoleResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const { id } = memberParamsSchema.parse(params);
    return assignRoleToMember(tx, ctx, id, input);
  },
});
