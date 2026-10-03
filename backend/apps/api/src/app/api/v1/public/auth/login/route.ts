import { NextResponse } from "next/server";
import {
  resolvePlatformHost,
  resolveRequestHostFromHeaders,
  resolveTenantFromRequest,
} from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { loginWithPassword, setAuthCookies } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal, ensureSelfServiceLearnerMembership } from "@atlas/membership";
import {
  PublicLoginRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { applyReferralForNewMembership } from "../../../../../../server/sales-referrals/sales-referrals.service";
import { routeMetadata } from "./route.metadata";

// loginWithPassword verifies with Supabase before mirroring the principal.
// Acquire a connection only for the mirror's atomic UPDATE or INSERT ON CONFLICT,
// not for its network wait. Neither statement requires a shared transaction.
const loginPrincipalDb: Parameters<typeof loginWithPassword>[0]["db"] = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const host = resolveRequestHostFromHeaders(req.headers);

  // Platform plane (e.g. platform.localhost) never resolves a tenant. Platform
  // operators authenticate against Supabase here; platform authorization is
  // enforced separately by the platform console shell gate.
  if (resolvePlatformHost(host)) {
    const rawBody: unknown = await req.json();
    rejectClientTenantId(rawBody);
    const input = PublicLoginRequestSchema.parse(rawBody);

    const result = await loginWithPassword({
      db: loginPrincipalDb,
      input: { email: input.email, password: input.password },
    });

    const status = result.identity.mfaEnabled ? "MFA_REQUIRED" : "AUTHENTICATED";
    const body = PublicAuthResponseSchema.parse({
      data: {
        status,
        redirectTo: status === "AUTHENTICATED" ? "/platform" : null,
      },
    });

    const response = NextResponse.json(body);

    setAuthCookies({
      response,
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresInSeconds: result.session.expiresIn,
    });

    return response;
  }

  const tenant = await withGlobalDb((db) => resolveTenantFromRequest({ req, db }));

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicLoginRequestSchema.parse(rawBody);

  const result = await loginWithPassword({
    db: loginPrincipalDb,
    input: {
      email: input.email,
      password: input.password,
    },
  });

  // Release global lookup work before requesting a connection for membership.
  const principalId = await withGlobalDb(async (db) => {
    const principalRows = await db.$queryRaw<{ id: string }[]>`
      select id::text
      from auth_principals
      where email_normalized = ${input.email}
      limit 1
    `;
    return principalRows[0]?.id;
  });

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      let membership = principalId
        ? await findMembershipByPrincipal({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principalId,
          })
        : null;

      // Open self-service signup: a verified user signing in for the first
      // time with no membership becomes an ACTIVE learner. Gated on a fully
      // authenticated (non-MFA-pending) session so we never provision before
      // a required MFA challenge is satisfied.
      // `loginWithPassword` resolves only on a completed password sign-in
      // and throws otherwise, so its status is always "signed_in" here.
      if (!result.identity.mfaEnabled && principalId && !membership) {
        const provisioned = await ensureSelfServiceLearnerMembership({
          tx,
          tenantId: tenant.tenantId,
          authPrincipalId: principalId,
          email: input.email,
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
            emailNormalized: input.email,
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
    persistent: input.rememberMe ?? false,
  });

  return response;
});
