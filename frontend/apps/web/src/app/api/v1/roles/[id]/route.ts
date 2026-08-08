import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { deleteRole, updateRole } from "@atlas/domain-access";
import {
  roleDetailResponseSchema,
  updateRoleBodySchema,
} from "@atlas/domain-access/schemas/access-admin";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { deleteRouteMetadata, putRouteMetadata } from "./route.metadata";

type RoleDetailResponse = z.output<typeof roleDetailResponseSchema>;
type UpdateRoleBody = z.output<typeof updateRoleBodySchema>;

export const PUT = createTenantRoute<UpdateRoleBody, RoleDetailResponse>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: updateRoleBodySchema,
  output: roleDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const { id } = uuidParamSchema.parse(params);
    return updateRole(tx, ctx, id, input);
  },
});

export const DELETE = createTenantRoute<Record<string, never>, RoleDetailResponse>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  output: roleDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return deleteRole(tx, ctx, id);
  },
});
