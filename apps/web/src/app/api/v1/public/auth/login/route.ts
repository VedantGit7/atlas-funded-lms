import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { loginWithPassword, setAuthCookies } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal } from "@atlas/membership";
import {
  PublicLoginRequestSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });

    const rawBody: unknown = await req.json();
    rejectClientTenantId(rawBody);
    const input = PublicLoginRequestSchema.parse(rawBody);

    const result = await loginWithPassword({
      db,
      input: {
        email: input.email,
        password: input.password,
      },
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
