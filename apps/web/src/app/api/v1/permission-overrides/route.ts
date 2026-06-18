import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createPermissionOverride, listPermissionOverrides } from "@atlas/domain-access";
import {
  createPermissionOverrideBodySchema,
  permissionOverrideListQuerySchema,
  permissionOverrideListResponseSchema,
  permissionOverrideResponseSchema,
} from "@atlas/domain-access/schemas/access-admin";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type OverrideListQuery = z.output<typeof permissionOverrideListQuerySchema>;
type OverrideListResponse = z.output<typeof permissionOverrideListResponseSchema>;
type CreateOverrideBody = z.output<typeof createPermissionOverrideBodySchema>;
type OverrideResponse = z.output<typeof permissionOverrideResponseSchema>;

export const GET = createTenantRoute<OverrideListQuery, OverrideListResponse>({
  metadata: getRouteMetadata,
  input: permissionOverrideListQuerySchema,
  output: permissionOverrideListResponseSchema,
  handler: async ({ tx, ctx, input }) =>
    listPermissionOverrides(tx, ctx, {
      limit: input.limit,
      ...(input.membershipId ? { membershipId: input.membershipId } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    }),
});

export const POST = createTenantRoute<CreateOverrideBody, OverrideResponse>({
  metadata: postRouteMetadata,
  body: createPermissionOverrideBodySchema,
  output: permissionOverrideResponseSchema,
  handler: async ({ tx, ctx, input }) => createPermissionOverride(tx, ctx, input),
});
