import { cookies, headers } from "next/headers";
import { loginWithPassword, signupWithPassword, verifyMfaChallenge } from "@atlas/auth";
import { publicSignupInputSchema } from "@atlas/auth/schemas";
import {
  applyAuthSessionToCookieStore,
  readSessionPersistenceFromStore,
} from "@atlas/auth/cookie-store";
import {
  ATLAS_ACCESS_TOKEN_COOKIE,
  ATLAS_REFRESH_TOKEN_COOKIE,
} from "@atlas/auth/cookies";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  findMembershipByPrincipal,
  ensurePlatformSuperAdminTenantAccess,
  ensureSelfServiceLearnerMembership,
} from "@atlas/membership";
import {
  lookupTenantFromHost,
  resolvePlatformHost,
  resolveRequestHostFromHeaders,
} from "@atlas/tenancy";
import {
  PublicLoginRequestSchema,
  PublicSignupRequestSchema,
  PublicAuthResponseSchema,
  buildPublicAuthResponse,
  type PublicAuthStatus,
} from "@atlas/domain-identity";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { applyReferralForNewMembership, stashReferralCodeForSignup } from "../server/sales-referrals/sales-referrals.service";
import type { PublicAuthApiResponse } from "./public-auth-types";

async function resolveActiveTenantFromRequest() {
  const headerList = await headers();
  const host = resolveRequestHostFromHeaders(headerList);
  const requestId = getOrCreateRequestId(headerList);

  return { host, requestId };
}

async function buildResponse(args: {
  db: {
    $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  };
  tenantId: string;
  requestId: string;
  email: string;
  serviceStatus: "signed_in" | "verification_required";
  mfaEnabled: boolean;
}): Promise<PublicAuthApiResponse> {
  // Grant the global platform super admin tenant-admin access before resolving
  // membership, so the role-based redirect below points it at /admin.
  if (args.serviceStatus === "signed_in") {
    await ensurePlatformSuperAdminTenantAccess({
      db: args.db,
      tenantId: args.tenantId,
      requestId: args.requestId,
      email: args.email,
    });
  }

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
      let membership = principalId
        ? await findMembershipByPrincipal({
            tx,
            tenantId: args.tenantId,
            authPrincipalId: principalId,
          })
        : null;

      // Open self-service signup: a fully authenticated user (including one who
      // just cleared an MFA challenge) with no membership becomes an ACTIVE
      // learner. `args.mfaEnabled` is false here once MFA has been satisfied.
      if (args.serviceStatus === "signed_in" && !args.mfaEnabled && principalId && !membership) {
        const provisioned = await ensureSelfServiceLearnerMembership({
          tx,
          tenantId: args.tenantId,
          authPrincipalId: principalId,
          email: args.email,
        });

        membership = await findMembershipByPrincipal({
          tx,
          tenantId: args.tenantId,
          authPrincipalId: principalId,
        });

        if (provisioned?.created && membership) {
          await applyReferralForNewMembership(tx, {
            refereeMembershipId: membership.id,
            emailNormalized: args.email,
          });
        }
      }

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
  expiresIn: number;
  persistent?: boolean;
}): Promise<void> {
  const persistent =
    session.persistent ?? (await readSessionPersistenceFromStore());

  await applyAuthSessionToCookieStore({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresInSeconds: session.expiresIn,
    persistent,
  });
}

export async function orchestratePublicLogin(input: {
  email: string;
  password: string;
}): Promise<PublicAuthApiResponse> {
  const parsed = PublicLoginRequestSchema.parse(input);
  const { host, requestId } = await resolveActiveTenantFromRequest();

  const { authResult, body } = await withGlobalDb(async (db) => {
    const tenant = await lookupTenantFromHost({ host, requestId, db });

    if (!tenant || tenant.tenantState !== "ACTIVE" || tenant.tenantDomainStatus !== "ACTIVE") {
      throw new Error("tenant unavailable");
    }

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

    return { authResult, body };
  });

  await setSessionCookies({
    accessToken: authResult.session.accessToken,
    refreshToken: authResult.session.refreshToken,
    expiresIn: authResult.session.expiresIn,
    persistent: parsed.rememberMe ?? false,
  });

  return body;
}

export async function orchestratePublicMfaVerify(input: {
  code: string;
}): Promise<PublicAuthApiResponse> {
  const { host, requestId } = await resolveActiveTenantFromRequest();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(ATLAS_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken || !refreshToken) {
    throw new Error("no_pending_session");
  }

  const verified = await verifyMfaChallenge({
    accessToken,
    refreshToken,
    code: input.code,
  });

  await setSessionCookies({
    accessToken: verified.session.accessToken,
    refreshToken: verified.session.refreshToken,
    expiresIn: verified.session.expiresIn,
  });

  // Platform plane has no tenant/membership; a verified challenge is sufficient
  // to enter the platform console (authorization is enforced by the shell gate).
  if (resolvePlatformHost(host)) {
    return PublicAuthResponseSchema.parse({
      data: {
        status: "AUTHENTICATED",
        redirectTo: "/platform",
      },
    });
  }

  const body = await withGlobalDb(async (db) => {
    const tenant = await lookupTenantFromHost({ host, requestId, db });

    if (!tenant || tenant.tenantState !== "ACTIVE" || tenant.tenantDomainStatus !== "ACTIVE") {
      throw new Error("tenant unavailable");
    }

    return buildResponse({
      db,
      tenantId: tenant.tenantId,
      requestId: tenant.requestId,
      email: verified.user.email,
      serviceStatus: "signed_in",
      // The challenge above already satisfies the MFA requirement for this
      // session, so the membership/redirect resolution below must not
      // re-trigger the MFA_REQUIRED gate.
      mfaEnabled: false,
    });
  });

  return body;
}

export async function orchestratePublicSignup(input: {
  email: string;
  password: string;
  displayName: string;
  inviteToken?: string;
  referralCode?: string;
}): Promise<PublicAuthApiResponse> {
  const parsed = PublicSignupRequestSchema.parse(input);
  const { host, requestId } = await resolveActiveTenantFromRequest();

  const { authResult, body } = await withGlobalDb(async (db) => {
    const tenant = await lookupTenantFromHost({ host, requestId, db });

    if (!tenant || tenant.tenantState !== "ACTIVE" || tenant.tenantDomainStatus !== "ACTIVE") {
      throw new Error("tenant unavailable");
    }

    if (parsed.referralCode) {
      await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId: tenant.requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          await stashReferralCodeForSignup(tx, {
            emailNormalized: parsed.email,
            referralCode: parsed.referralCode!,
          });
        },
      );
    }

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

    return { authResult, body };
  });

  if (authResult.session) {
    await setSessionCookies({
      accessToken: authResult.session.accessToken,
      refreshToken: authResult.session.refreshToken,
      expiresIn: authResult.session.expiresIn,
    });
  }

  return body;
}

export type { PublicAuthStatus };
