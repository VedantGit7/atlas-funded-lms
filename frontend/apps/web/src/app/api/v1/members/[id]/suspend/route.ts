import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { suspendMember, suspendMemberResponseSchema } from "@atlas/membership";
import { routeMetadata } from "./route.metadata";

type SuspendResponse = z.output<typeof suspendMemberResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, SuspendResponse>({
  metadata: routeMetadata,
  params: uuidParamSchema,
  output: suspendMemberResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return suspendMember(tx, ctx, id);
  },
});
