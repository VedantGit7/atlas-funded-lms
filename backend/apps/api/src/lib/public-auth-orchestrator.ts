import { headers } from "next/headers";
import {
  applySetCookiesToCookieStore,
  authRequestContextFromHeaders,
  findActiveSessionPrincipal,
  verifySecondFactor,
} from "@atlas/auth";
import { globalDbPerStatement } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { findMembershipByPrincipal, ensureSelfServiceLearnerMembership } from "@atlas/membership";
import {
  lookupTenantFromHost,
  resolvePlatformHost,
  resolveRequestHostFromHeaders,
} from "@atlas/tenancy";
import {
  PublicAuthResponseSchema,
  buildPublicAuthResponse,
  type PublicAuthStatus,
} from "@atlas/domain-identity";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { applyReferralForNewMembership } from "../server/sales-referrals/sales-referrals.service";
import type { PublicAuthApiResponse } from "./public-auth-types";

async function resolveActiveTenantFromRequest() {
  const headerList = await headers();
  const host = resolveRequestHostFromHeaders(headerList);
  const requestId = getOrCreateRequestId(headerList);

  return { host, requestId };
}

/**
 * The active tenant for a host, on a short-lived connection released before any
 * auth round trip or tenant transaction (audit H3).
 */
async function lookupActiveTenant(host: string, requestId: string) {
  const tenant = await withGlobalDb((db) => lookupTenantFromHost({ host, requestId, db }));
  if (!tenant || tenant.tenantState !== "ACTIVE" || tenant.tenantDomainStatus !== "ACTIVE") {
    throw new Error("tenant unavailable");
  }
  return tenant;
}

async function buildResponse(args: {
  tenantId: string;
  requestId: string;
  email: string;
  serviceStatus: "signed_in" | "verification_required";
  mfaEnabled: boolean;
}): Promise<PublicAuthApiResponse> {
  // A global table: read on its own connection, never from inside the tenant transaction.
  const principalRows = await globalDbPerStatement.$queryRaw<{ id: string }[]>`
    select id::text
    from auth_principals
    where email_normalized = ${args.email}
    limit 1
  `;
  const principalId = principalRows[0]?.id;

  return withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      let membership = principalId
        ? await findMembershipByPrincipal({
            tx,
            tenantId: args.tenantId,
            authPrincipalId: principalId,
          })
        : null;
      let pendingInvitation: { id: string; status: "INVITED" } | null = null;

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

        // An invitation to this email is waiting: answer INVITED_MEMBERSHIP so
        // the person goes on to accept it, rather than "no access".
        if (!membership && provisioned?.status === "INVITED") {
          pendingInvitation = { id: provisioned.membershipId, status: "INVITED" };
        }

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
        membership: membership
          ? { id: membership.id, status: membership.status }
          : pendingInvitation,
      });
    },
  );
}

export async function orchestratePublicMfaVerify(input: {
  code: string;
}): Promise<PublicAuthApiResponse> {
  const { host, requestId } = await resolveActiveTenantFromRequest();

  // The pending challenge from a password sign-in (Better Auth's two_factor
  // cookie), or an aal1 session from Google or a sign-in link: either way an
  // aal2 session is left behind (launch plan task 3.5).
  const verified = await verifySecondFactor({
    ctx: authRequestContextFromHeaders(new Headers(await headers())),
    code: input.code,
  });
  await applySetCookiesToCookieStore(verified.cookies.setCookies);
  const principal = await findActiveSessionPrincipal({
    db: globalDbPerStatement,
    principalId: verified.principalId,
  });
  const email = principal.email;

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

  const tenant = await lookupActiveTenant(host, requestId);
  const body = await buildResponse({
    tenantId: tenant.tenantId,
    requestId: tenant.requestId,
    email,
    serviceStatus: "signed_in",
    // The challenge above already satisfies the MFA requirement for this
    // session, so the membership/redirect resolution below must not
    // re-trigger the MFA_REQUIRED gate.
    mfaEnabled: false,
  });

  return body;
}

export type { PublicAuthStatus };
