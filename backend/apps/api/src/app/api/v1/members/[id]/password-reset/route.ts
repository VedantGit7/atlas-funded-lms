import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { sendMemberPasswordReset } from "../../../../../../server/members/member-overview.service";
import { memberPasswordResetResponseSchema } from "../../../../../../server/members/member-overview.schemas";
import { routeMetadata } from "./route.metadata";

type PasswordResetResponse = z.output<typeof memberPasswordResetResponseSchema>;

export const POST = createTenantRoute<Record<string, never>, PasswordResetResponse>({
  metadata: routeMetadata,
  params: uuidParamSchema,
  output: memberPasswordResetResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return sendMemberPasswordReset(tx, ctx, id);
  },
});
