import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { deleteRole, getRoleById, updateRole } from "@atlas/domain-access";
import {
  roleDetailResponseSchema,
  updateRoleBodySchema,
} from "@atlas/domain-access/schemas/access-admin";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { deleteRouteMetadata, getByIdRouteMetadata, putRouteMetadata } from "./route.metadata";

type RoleDetailResponse = z.output<typeof roleDetailResponseSchema>;
type UpdateRoleBody = z.output<typeof updateRoleBodySchema>;

export const GET = createTenantRoute<Record<string, never>, RoleDetailResponse>({
  metadata: getByIdRouteMetadata,
  params: uuidParamSchema,
  output: roleDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return getRoleById(tx, ctx, id);
  },
});

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
