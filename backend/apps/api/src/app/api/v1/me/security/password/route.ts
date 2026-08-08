import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { changePassword } from "@atlas/auth";
import {
  AccountSecurityOkResponseSchema,
  ChangePasswordRequestSchema,
} from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../route.metadata";

type ChangePasswordBody = z.output<typeof ChangePasswordRequestSchema>;

export const POST = createTenantRoute<ChangePasswordBody, z.output<typeof AccountSecurityOkResponseSchema>>({
  metadata: securityMutationMetadata,
  body: ChangePasswordRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const result = await changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });

    await emitSecurityNotification(tx, ctx, {
      eventType: "security.password_changed",
      email: result.email,
    });

    return { data: { ok: true as const } };
  },
});
