import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { publicSignupInputSchema, setAuthCookies, signupWithPassword } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  findMembershipByPrincipal,
  ensureSelfServiceLearnerMembership,
} from "@atlas/membership";
import {
  PublicSignupRequestSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { dispatchMarketingIntegrationWebhooks } from "../../../../../../server/marketing-integrations/marketing-integrations.dispatch";
import {
  applyReferralForNewMembership,
  stashReferralCodeForSignup,
} from "../../../../../../server/sales-referrals/sales-referrals.service";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const rawBody: unknown = await req.json();
    rejectClientTenantId(rawBody);
    const input = PublicSignupRequestSchema.parse(rawBody);

    // Validate + stash referral before creating the auth principal so a bad
    // code cannot leave an orphaned signup behind.
    if (input.referralCode) {
      await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          await stashReferralCodeForSignup(tx, {
            emailNormalized: input.email,
            referralCode: input.referralCode!,
          });
        },
      );
    }

    const result = await signupWithPassword({
      db,
      input: publicSignupInputSchema.parse({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        inviteToken: input.inviteToken,
        referralCode: input.referralCode,
        emailRedirectTo: input.emailRedirectTo,
      }),
    });

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        const principalRows = await db.$queryRaw<{ id: string }[]>`
          select id::text
          from auth_principals
          where email_normalized = ${input.email}
          limit 1
        `;
        const principalId = principalRows[0]?.id;

        let membership = principalId
          ? await findMembershipByPrincipal({
              tx,
              tenantId: tenant.tenantId,
              authPrincipalId: principalId,
            })
          : null;

        // When email confirmation is disabled, signup returns an immediate
        // session. Provision the open self-service learner membership here so
        // the dev flow completes end-to-end. When confirmation is required,
        // there is no session and provisioning happens on first login instead.
        if (
          result.status === "signed_in" &&
          !(result.identity?.mfaEnabled ?? false) &&
          principalId &&
          !membership
        ) {
          const provisioned = await ensureSelfServiceLearnerMembership({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
            email: input.email,
            displayName: input.displayName,
          });

          membership = await findMembershipByPrincipal({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
          });

          if (provisioned?.created && membership) {
            await applyReferralForNewMembership(tx, {
              refereeMembershipId: membership.id,
              emailNormalized: input.email,
              referralCode: input.referralCode ?? null,
            });
          }
        }

        if (membership) {
          try {
            await dispatchMarketingIntegrationWebhooks(
              tx,
              { tenantId: tenant.tenantId },
              "sign_up",
              {
                email: input.email,
                name: input.displayName ?? null,
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
          mfaEnabled: result.identity?.mfaEnabled ?? false,
          membership: membership ? { id: membership.id, status: membership.status } : null,
        });
      },
    );

    const response = NextResponse.json(body);

    if (result.session) {
      setAuthCookies({
        response,
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        expiresInSeconds: result.session.expiresIn,
      });
    }

    return response;
  });
});
