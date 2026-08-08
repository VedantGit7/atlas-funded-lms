import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  getMember,
  memberDetailResponseSchema,
  removeMember,
  removeMemberResponseSchema,
} from "@atlas/membership";
import { deleteRouteMetadata, getRouteMetadata } from "./route.metadata";

type MemberDetailResponse = z.output<typeof memberDetailResponseSchema>;
type RemoveMemberResponse = z.output<typeof removeMemberResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, MemberDetailResponse>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: memberDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return getMember(tx, ctx, id);
  },
});

export const DELETE = createTenantRoute<Record<string, never>, RemoveMemberResponse>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  output: removeMemberResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return removeMember(tx, ctx, id);
  },
});
