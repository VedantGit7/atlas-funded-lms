import type { z } from "zod";
import { assertRedirectOnRequestHost, createTenantRoute } from "@atlas/api";
import { changeEmail } from "@atlas/auth";
import { AccountSecurityOkResponseSchema, ChangeEmailRequestSchema } from "@atlas/domain-identity";
import { emitSecurityNotification } from "../../../../../../lib/account-security-orchestrator";
import { securityMutationMetadata } from "../route.metadata";
import { headers } from "next/headers";
import { sendAuthEmails } from "../../../../../../lib/auth-email";

type ChangeEmailBody = z.output<typeof ChangeEmailRequestSchema>;

export const POST = createTenantRoute<
  ChangeEmailBody,
  z.output<typeof AccountSecurityOkResponseSchema>
>({
  metadata: securityMutationMetadata,
  body: ChangeEmailRequestSchema,
  output: AccountSecurityOkResponseSchema,
  handler: async ({ tx, ctx, input, requestHost }) => {
    const emailRedirectTo = input.emailRedirectTo
      ? assertRedirectOnRequestHost({
          value: input.emailRedirectTo,
          requestHost: requestHost ?? "",
          field: "emailRedirectTo",
        })
      : undefined;
    const result = await changeEmail({
      newEmail: input.newEmail,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    });
    // Better Auth: the approval link to the current address. Read the sender
    // on this transaction's connection (audit H3).
    if (result.emails?.length) {
      await sendAuthEmails({
        req: new Request("http://localhost/", { headers: new Headers(await headers()) }),
        requestId: ctx.requestId,
        emails: result.emails,
        tenant: { tx, tenantId: ctx.tenantId },
      });
    }

    await emitSecurityNotification(tx, ctx, {
      eventType: "security.email_changed",
      email: result.email,
    });

    return { data: { ok: true as const } };
  },
});
