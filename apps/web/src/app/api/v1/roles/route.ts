import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createRole, listRoles } from "@atlas/domain-access";
import {
  createRoleBodySchema,
  roleDetailResponseSchema,
  roleListQuerySchema,
  roleListResponseSchema,
} from "@atlas/domain-access/schemas/access-admin";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type RoleListQuery = z.output<typeof roleListQuerySchema>;
type RoleListResponse = z.output<typeof roleListResponseSchema>;
type CreateRoleBody = z.output<typeof createRoleBodySchema>;
type RoleDetailResponse = z.output<typeof roleDetailResponseSchema>;

export const GET = createTenantRoute<RoleListQuery, RoleListResponse>({
  metadata: getRouteMetadata,
  input: roleListQuerySchema,
  output: roleListResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    listRoles(tx, ctx, {
      limit: input.limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    }),
});

export const POST = createTenantRoute<CreateRoleBody, RoleDetailResponse>({
  metadata: postRouteMetadata,
  body: createRoleBodySchema,
  output: roleDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createRole(tx, ctx, input),
});
