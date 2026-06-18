import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  getMemberProfile,
  memberProfileResponseSchema,
  updateMemberProfile,
  updateMemberProfileBodySchema,
} from "@atlas/membership";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type ProfileResponse = z.output<typeof memberProfileResponseSchema>;
type UpdateProfileBody = z.output<typeof updateMemberProfileBodySchema>;

export const GET = createTenantRoute<Record<string, never>, ProfileResponse>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: memberProfileResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return getMemberProfile(tx, ctx, id);
  },
});

export const PUT = createTenantRoute<UpdateProfileBody, ProfileResponse>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: updateMemberProfileBodySchema,
  output: memberProfileResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const { id } = uuidParamSchema.parse(params);
    return updateMemberProfile(tx, ctx, id, input);
  },
});
