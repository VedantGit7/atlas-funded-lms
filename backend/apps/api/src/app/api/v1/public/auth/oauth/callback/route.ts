import { NextResponse } from "next/server";
import {
  resolvePlatformHost,
  resolveRequestHostFromHeaders,
  resolveTenantFromRequest,
} from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { completeOAuthSignIn, setAuthCookies } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal } from "@atlas/membership";
import {
  PublicOAuthCallbackRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const host = resolveRequestHostFromHeaders(req.headers);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicOAuthCallbackRequestSchema.parse(rawBody);
  const persistent = input.rememberMe ?? false;

  // Platform plane has no tenant/membership; a completed OAuth exchange is
  // sufficient to enter the platform console (authorization is enforced by the
  // platform console shell gate).
  if (resolvePlatformHost(host)) {
    const result = await withGlobalDb(async (db) =>
      completeOAuthSignIn({ db, code: input.code, codeVerifier: input.codeVerifier }),
    );

    const body = PublicAuthResponseSchema.parse({
      data: { status: "AUTHENTICATED", redirectTo: "/platform" },
    });

    const response = NextResponse.json(body);
    setAuthCookies({
      response,
      accessToken: result.session.accessToken,
      refreshToken: result.session.refreshToken,
      expiresInSeconds: result.session.expiresIn,
      persistent,
    });

    return response;
  }

  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const result = await completeOAuthSignIn({
      db,
      code: input.code,
      codeVerifier: input.codeVerifier,
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

        const membership = principalId
          ? await findMembershipByPrincipal({
              tx,
              tenantId: tenant.tenantId,
              authPrincipalId: principalId,
            })
          : null;

        return buildPublicAuthResponse({
          tx,
          tenantId: tenant.tenantId,
          serviceStatus: result.status,
          // OAuth providers complete their own MFA; no second challenge here.
          mfaEnabled: false,
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
      persistent,
    });

    return response;
  });
});
