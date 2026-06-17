import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { toSafeErrorEnvelope } from "@atlas/core/http/errors";
import { requireSupabaseUser, toSessionSafeIdentity, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  findMemberProfile,
  meMembershipOutputSchema,
  requireActiveMembership,
} from "@atlas/membership";
import { can, createTenantResourceRef, toAuthorizationError } from "@atlas/authorization";

export const routeMetadata = {
  permission: "profile.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  audit: "none",
} as const;

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

  try {
    return await withGlobalDb(async (db) => {
      const tenant = await resolveTenantFromRequest({ req, db });
      const supabaseUser = await requireSupabaseUser(req);
      const principal = await upsertAuthPrincipal({
        db,
        supabaseUserId: supabaseUser.supabaseUserId,
        email: supabaseUser.email,
        mfaEnabled: supabaseUser.mfaEnabled,
        markLogin: false,
      });

      const result = await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          const membership = await requireActiveMembership({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principal.id,
          });

          const profile = await findMemberProfile({
            tx,
            tenantId: tenant.tenantId,
            membershipId: membership.membershipId,
          });

          const resource = createTenantResourceRef({
            type: "member_profile",
            id: profile?.id ?? membership.membershipId,
            tenantId: tenant.tenantId,
            ownerMembershipId: membership.membershipId,
          });

          const decision = await can({
            tx,
            actor: {
              tenantId: tenant.tenantId,
              membershipId: membership.membershipId,
            },
            permission: "profile.read",
            resource,
            ctx: {
              tenantId: tenant.tenantId,
              requestId,
            },
          });

          if (!decision.allowed) {
            throw toAuthorizationError(decision);
          }

          return { membership, profile };
        },
      );

      const body = meMembershipOutputSchema.parse({
        data: {
          tenant: {
            id: tenant.tenantId,
            slug: tenant.tenantSlug,
            state: tenant.tenantState,
          },
          identity: toSessionSafeIdentity(principal),
          membership: {
            id: result.membership.membershipId,
            status: "ACTIVE",
          },
          profile: result.profile
            ? {
                id: result.profile.id,
                displayName: result.profile.displayName,
                avatarUrl: result.profile.avatarUrl,
              }
            : null,
        },
      });

      return NextResponse.json(body);
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
