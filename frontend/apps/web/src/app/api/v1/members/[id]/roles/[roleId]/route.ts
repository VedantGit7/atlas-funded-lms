import type { z } from "zod";
import { z as zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { revokeRoleFromMember } from "@atlas/domain-access";
import { memberRoleParamsSchema } from "@atlas/membership/schemas/shared";
import { routeMetadata } from "./route.metadata";

const revokeRoleResponseSchema = zod.object({
  data: zod.object({
    membershipId: zod.uuid(),
    roleId: zod.uuid(),
    revoked: zod.literal(true),
  }),
});

type RevokeRoleResponse = z.output<typeof revokeRoleResponseSchema>;

export const DELETE = createTenantRoute<Record<string, never>, RevokeRoleResponse>({
  metadata: routeMetadata,
  params: memberRoleParamsSchema,
  output: revokeRoleResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id, roleId } = memberRoleParamsSchema.parse(params);
    return revokeRoleFromMember(tx, ctx, id, roleId);
  },
});
