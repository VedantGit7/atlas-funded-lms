import { cookies, headers } from "next/headers";
import { loginWithPassword, signupWithPassword, publicSignupInputSchema } from "@atlas/auth";
import { ATLAS_ACCESS_TOKEN_COOKIE, ATLAS_REFRESH_TOKEN_COOKIE } from "@atlas/auth/cookies";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal } from "@atlas/membership";
import { lookupTenantFromHost } from "@atlas/tenancy";
import {
  PublicLoginRequestSchema,
  PublicSignupRequestSchema,
  buildPublicAuthResponse,
  type PublicAuthStatus,
} from "@atlas/domain-identity";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import type { PublicAuthApiResponse } from "../api/public-client";

async function resolveActiveTenant() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost";
  const requestId = getOrCreateRequestId(headerList);

  return withGlobalDb(async (db) => {
    const tenant = await lookupTenantFromHost({ host, requestId, db });

    if (!tenant || tenant.tenantState !== "ACTIVE" || tenant.tenantDomainStatus !== "ACTIVE") {
      throw new Error("tenant unavailable");
    }

    return { db, tenant };
  });
}

async function buildResponse(args: {
  db: { $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> };
  tenantId: string;
  requestId: string;
  email: string;
  serviceStatus: "signed_in" | "verification_required";
  mfaEnabled: boolean;
}): Promise<PublicAuthApiResponse> {
  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const principalRows = await args.db.$queryRaw<{ id: string }[]>`
        select id::text
        from auth_principals
        where email_normalized = ${args.email}
        limit 1
      `;
      const principalId = principalRows[0]?.id;
      const membership = principalId
        ? await findMembershipByPrincipal({
            tx,
            tenantId: args.tenantId,
            authPrincipalId: principalId,
          })
        : null;

      return buildPublicAuthResponse({
        tx,
        tenantId: args.tenantId,
        serviceStatus: args.serviceStatus,
        mfaEnabled: args.mfaEnabled,
        membership: membership ? { id: membership.id, status: membership.status } : null,
      });
    },
  );
}

async function setSessionCookies(session: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ATLAS_ACCESS_TOKEN_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set(ATLAS_REFRESH_TOKEN_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function orchestratePublicLogin(input: {
  email: string;
  password: string;
}): Promise<PublicAuthApiResponse> {
  const parsed = PublicLoginRequestSchema.parse(input);
  const { db, tenant } = await resolveActiveTenant();

  const authResult = await loginWithPassword({
    db,
    input: parsed,
  });

  const body = await buildResponse({
    db,
    tenantId: tenant.tenantId,
    requestId: tenant.requestId,
    email: parsed.email,
    serviceStatus: authResult.status,
    mfaEnabled: authResult.identity.mfaEnabled,
  });

  await setSessionCookies(authResult.session);

  return body;
}

export async function orchestratePublicSignup(input: {
  email: string;
  password: string;
  displayName: string;
  inviteToken?: string;
}): Promise<PublicAuthApiResponse> {
  const parsed = PublicSignupRequestSchema.parse(input);
  const { db, tenant } = await resolveActiveTenant();

  const authResult = await signupWithPassword({
    db,
    input: publicSignupInputSchema.parse(parsed),
  });

  const body = await buildResponse({
    db,
    tenantId: tenant.tenantId,
    requestId: tenant.requestId,
    email: parsed.email,
    serviceStatus: authResult.status,
    mfaEnabled: authResult.identity?.mfaEnabled ?? false,
  });

  if (authResult.session) {
    await setSessionCookies(authResult.session);
  }

  return body;
}

export type { PublicAuthStatus };
