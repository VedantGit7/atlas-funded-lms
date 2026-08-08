import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { deletePermissionOverride } from "@atlas/domain-access";
import { deletePermissionOverrideResponseSchema } from "@atlas/domain-access/schemas/access-admin";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { routeMetadata } from "./route.metadata";

type DeleteOverrideResponse = z.output<typeof deletePermissionOverrideResponseSchema>;

export const DELETE = createTenantRoute<Record<string, never>, DeleteOverrideResponse>({
  metadata: routeMetadata,
  params: uuidParamSchema,
  output: deletePermissionOverrideResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return deletePermissionOverride(tx, ctx, id);
  },
});
