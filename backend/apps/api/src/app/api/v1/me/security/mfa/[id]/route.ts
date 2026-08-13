import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { unenrollMfaFactor } from "@atlas/auth";
import { AccountSecurityOkResponseSchema } from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../../route.metadata";

const mfaParamsSchema = z.object({ id: z.uuid() }).strict();

export const DELETE = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof AccountSecurityOkResponseSchema>,
  typeof mfaParamsSchema
>({
  metadata: securityMutationMetadata,
  params: mfaParamsSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const factorId: string = params.id;
    await unenrollMfaFactor({ factorId });

    const emailRows = await tx.$queryRaw<Array<{ email: string }>>`
      select ap.email
      from memberships m
      join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${ctx.actorMembershipId}::uuid
        and m.tenant_id = ${ctx.tenantId}::uuid
      limit 1
    `;

    const email = emailRows[0]?.email;
    if (email) {
      await emitSecurityNotification(tx, ctx, {
        eventType: "security.mfa_disabled",
        email,
      });
    }

    return { data: { ok: true as const } };
  },
});
