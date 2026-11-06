import { NextResponse } from "next/server";
import {
  resolvePlatformHost,
  resolveRequestHostFromHeaders,
  resolveTenantFromRequest,
} from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { applyAuthSession, loginWithPassword } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicLoginRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { resolveSignInMembership } from "../../../../../../lib/sign-in-membership";
import { routeMetadata } from "./route.metadata";

// One connection per statement: none is held while the password is checked.
const loginPrincipalDb: Parameters<typeof loginWithPassword>[0]["db"] = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const host = resolveRequestHostFromHeaders(req.headers);

  // Platform plane (e.g. platform.localhost) never resolves a tenant. Platform
  // operators sign in here; platform authorization is enforced separately by
  // the platform console shell gate.
  if (resolvePlatformHost(host)) {
    const rawBody: unknown = await req.json();
    rejectClientTenantId(rawBody);
    const input = PublicLoginRequestSchema.parse(rawBody);

    const result = await loginWithPassword({
      db: loginPrincipalDb,
      input: { email: input.email, password: input.password },
      req,
    });

    const status = result.identity.mfaEnabled ? "MFA_REQUIRED" : "AUTHENTICATED";
    const body = PublicAuthResponseSchema.parse({
      data: {
        status,
        redirectTo: status === "AUTHENTICATED" ? "/platform" : null,
      },
    });

    const response = NextResponse.json(body);

    applyAuthSession({ response, session: result.session });

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
      rememberMe: input.rememberMe ?? false,
    },
    req,
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
      // `loginWithPassword` resolves only on a completed password sign-in and
      // throws otherwise, so sign-up waits only for a pending MFA challenge.
      const membership = await resolveSignInMembership(tx, {
        tenantId: tenant.tenantId,
        principalId,
        email: input.email,
        provision: !result.identity.mfaEnabled,
      });

      return buildPublicAuthResponse({
        tx,
        tenantId: tenant.tenantId,
        serviceStatus: result.status,
        mfaEnabled: result.identity.mfaEnabled,
        membership,
      });
    },
  );

  const response = NextResponse.json(body);

  applyAuthSession({ response, session: result.session });

  return response;
});
