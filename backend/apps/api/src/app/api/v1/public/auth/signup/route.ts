import { NextResponse } from "next/server";
import { createPublicRouteHandler, globalDbPerStatement, resolveRequestTenant } from "@atlas/api";
import { publicSignupInputSchema, signupWithPassword } from "@atlas/auth";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal } from "@atlas/membership";
import {
  PublicSignupRequestSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { dispatchMarketingIntegrationWebhooks } from "../../../../../../server/marketing-integrations/marketing-integrations.dispatch";
import { stashReferralCodeForSignup } from "../../../../../../server/sales-referrals/sales-referrals.service";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  // One pooled connection at a time, none during the sign-up itself (audit H3).
  const tenant = await resolveRequestTenant(req);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicSignupRequestSchema.parse(rawBody);

  // Validate + stash referral before creating the auth principal so a bad
  // code cannot leave an orphaned signup behind.
  const referralCode = input.referralCode;
  if (referralCode) {
    await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        await stashReferralCodeForSignup(tx, {
          emailNormalized: input.email,
          referralCode,
        });
      },
    );
  }

  const result = await signupWithPassword({
    db: globalDbPerStatement,
    input: publicSignupInputSchema.parse({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      inviteToken: input.inviteToken,
      referralCode: input.referralCode,
    }),
    req,
  });
  // Better Auth leaves the verification email to us, sent from the academy.
  await sendAuthEmails({ req, requestId, emails: result.emails });

  const principalRows = await globalDbPerStatement.$queryRaw<{ id: string }[]>`
    select id::text
    from auth_principals
    where email_normalized = ${input.email}
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
      // Nobody is signed in until the address is verified; the learner
      // membership is provisioned at that first sign-in. An address that
      // already belongs to a member is answered for that membership.
      const membership = principalId
        ? await findMembershipByPrincipal({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
          })
        : null;

      if (membership) {
        try {
          await dispatchMarketingIntegrationWebhooks(
            tx,
            { tenantId: tenant.tenantId, actorMembershipId: membership.id, requestId },
            "sign_up",
            {
              email: input.email,
              name: input.displayName,
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
        mfaEnabled: false,
        membership: membership ? { id: membership.id, status: membership.status } : null,
      });
    },
  );

  return NextResponse.json(body);
});
