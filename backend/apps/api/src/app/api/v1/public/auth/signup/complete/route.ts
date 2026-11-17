import { NextResponse } from "next/server";
import { createPublicRouteHandler, globalDbPerStatement, resolveRequestTenant } from "@atlas/api";
import { applyAuthSession, completeSignup, publicSignupCompleteInputSchema } from "@atlas/auth";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicSignupCompleteRequestSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { dispatchMarketingIntegrationWebhooks } from "../../../../../../../server/marketing-integrations/marketing-integrations.dispatch";
import { resolveSignInMembership } from "../../../../../../../lib/sign-in-membership";
import { routeMetadata } from "./route.metadata";

/**
 * Finishes a sign-up from its emailed link (security review 5.3, finding 1).
 * The link proved the address, so the account is created verified with the
 * password chosen now, the open learner membership for this academy is made,
 * and the session cookie is set: the same end state as a first sign-in.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  // One pooled connection at a time, none while the account is made (audit H3).
  const tenant = await resolveRequestTenant(req);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicSignupCompleteRequestSchema.parse(rawBody);

  const result = await completeSignup({
    db: globalDbPerStatement,
    input: publicSignupCompleteInputSchema.parse(input),
    req,
  });

  const principalRows = await globalDbPerStatement.$queryRaw<{ id: string }[]>`
    select id::text
    from auth_principals
    where email_normalized = ${result.identity.emailNormalized}
    limit 1
  `;
  const principalId = principalRows[0]?.id;

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      // A new account has no authenticator, so its membership is made now.
      const membership = await resolveSignInMembership(tx, {
        tenantId: tenant.tenantId,
        principalId,
        email: result.identity.emailNormalized,
        provision: !result.identity.mfaEnabled,
      });

      if (membership) {
        try {
          await dispatchMarketingIntegrationWebhooks(
            tx,
            { tenantId: tenant.tenantId, actorMembershipId: membership.id, requestId },
            "sign_up",
            {
              email: result.identity.emailNormalized,
              membershipId: membership.id,
              source: "public_signup",
            },
          );
        } catch {
          // Webhook fan-out must never block signup.
        }
      }

      return buildPublicAuthResponse({
        tx,
        tenantId: tenant.tenantId,
        serviceStatus: result.status,
        mfaEnabled: result.identity.mfaEnabled,
        membership,
      });
    },
  );

  // A sign-up that started from an invitation opens it next.
  const response = NextResponse.json(
    result.inviteToken
      ? {
          data: {
            ...body.data,
            redirectTo: `/invite/accept?token=${encodeURIComponent(result.inviteToken)}`,
          },
        }
      : body,
  );

  applyAuthSession({ response, session: result.session });

  return response;
});
