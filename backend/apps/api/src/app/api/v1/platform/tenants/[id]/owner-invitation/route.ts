import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { authProvider, sendTenantInvitationEmail } from "@atlas/auth";
import { sendInvitationEmail } from "../../../../../../../lib/auth-email";
import { issueTenantOwnerInvitation } from "@atlas/domain-tenancy";
import {
  PlatformTenantParamsSchema,
  TenantLifecycleRequestSchema,
  TenantOwnerInvitationResponseSchema,
} from "@atlas/domain-tenancy/schemas/platform-tenants";
import { routeMetadata } from "./route.metadata";

/**
 * Emails the tenant's owner a fresh invitation to the tenant's live domain.
 * Provisioning creates the invitation (with the owner role) but has no domain
 * to link to yet. Sent inside the transaction: if the email fails, the new
 * token is rolled back and the previous one stays valid.
 */
export const POST = createPlatformRoute({
  metadata: routeMetadata,
  params: PlatformTenantParamsSchema,
  body: TenantLifecycleRequestSchema,
  output: TenantOwnerInvitationResponseSchema,
  handler: async ({ tx, params, ctx }) => {
    const appEnv = process.env["APP_ENV"]?.trim();
    const invitation = await issueTenantOwnerInvitation(
      tx,
      {
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
        reason: ctx.reason,
      },
      params.id,
      { allowLocalHostnames: appEnv !== "staging" && appEnv !== "production" },
    );

    if (authProvider() === "better-auth") {
      // With the academy's own branding, read in its scope rather than this
      // platform transaction's (launch plan task 3.6).
      await sendInvitationEmail({
        tenantId: params.id,
        requestId: ctx.requestId,
        to: invitation.email,
        inviteUrl: invitation.inviteUrl,
      });
    } else {
      await sendTenantInvitationEmail({ email: invitation.email, inviteUrl: invitation.inviteUrl });
    }

    return {
      data: {
        email: invitation.email,
        hostname: invitation.hostname,
        expiresAt: invitation.expiresAt ? invitation.expiresAt.toISOString() : null,
      },
    };
  },
});
