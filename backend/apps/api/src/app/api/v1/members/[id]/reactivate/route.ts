import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { reactivateMember, reactivateMemberResponseSchema } from "@atlas/membership";
import { routeMetadata } from "./route.metadata";

type ReactivateResponse = z.output<typeof reactivateMemberResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, ReactivateResponse>({
  metadata: routeMetadata,
  params: uuidParamSchema,
  output: reactivateMemberResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return reactivateMember(tx, ctx, id);
  },
});
