import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { establishSessionFromTokenHash, setAuthCookies } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  findMembershipByPrincipal,
  ensureSelfServiceLearnerMembership,
} from "@atlas/membership";
import {
  PublicAuthConfirmRequestSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { applyReferralForNewMembership } from "../../../../../../server/sales-referrals/sales-referrals.service";
import { routeMetadata } from "./route.metadata";

/**
 * Completes email verification for self-service signup. The SSR confirm route
 * forwards the single-use `token_hash` from the verification link here; we
 * verify it with Supabase (token-hash/PKCE flow), provision the open learner
 * membership for this tenant, and issue the Atlas session cookies — the same end
 * state as a first login.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const rawBody: unknown = await req.json();
    rejectClientTenantId(rawBody);
    const input = PublicAuthConfirmRequestSchema.parse(rawBody);

    const result = await establishSessionFromTokenHash({
      db,
      tokenHash: input.tokenHash,
      type: input.type,
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
          where email_normalized = ${result.identity.emailNormalized}
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

        if (!result.identity.mfaEnabled && principalId && !membership) {
          const provisioned = await ensureSelfServiceLearnerMembership({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
            email: result.identity.emailNormalized,
            displayName: result.displayName,
          });

          membership = await findMembershipByPrincipal({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
          });

          if (provisioned?.created && membership) {
            await applyReferralForNewMembership(tx, {
              refereeMembershipId: membership.id,
              emailNormalized: result.identity.emailNormalized,
            });
          }
        }

        return buildPublicAuthResponse({
          tx,
          tenantId: tenant.tenantId,
          serviceStatus: result.status,
          mfaEnabled: result.identity.mfaEnabled,
          membership: membership ? { id: membership.id, status: membership.status } : null,
        });
      },
    );

    const response = NextResponse.json(body);

    setAuthCookies({
      response,
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresInSeconds: result.session.expiresIn,
    });

    return response;
  });
});
