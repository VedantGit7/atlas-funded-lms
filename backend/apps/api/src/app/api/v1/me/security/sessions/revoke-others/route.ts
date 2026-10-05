import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { signOutOtherSessions } from "@atlas/auth";
import { AccountSecurityOkResponseSchema } from "@atlas/domain-identity";
import { recordAuditChange } from "@atlas/api-server/audit-change";
import { securityMutationMetadata } from "../../route.metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx }) => {
    await signOutOtherSessions();
    await recordAuditChange(tx, ctx, {
      action: "security.other_sessions_revoked",
      target: { type: "membership", id: ctx.actorMembershipId },
      before: null,
      after: null,
    });
    return { data: { ok: true as const } };
  },
});
