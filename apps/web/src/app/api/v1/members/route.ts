import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import {
  runProtectedTenantRouteHandler,
  toSafeErrorEnvelope,
  type RouteMetadata,
} from "@atlas/api";
import { createTenantResourceRef } from "@atlas/authorization";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  listMembersForTenant,
  membersListOutputSchema,
  requireActiveMembership,
} from "@atlas/membership";

const membersRouteMetadata: RouteMetadata = {
  permission: "membership.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  audit: "none",
  resourceLoader: ({ ctx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "membership_collection",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
};

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

          return runProtectedTenantRouteHandler({
            tx,
            ctx: {
              tenantId: tenant.tenantId,
              requestId,
              actorMembershipId: membership.membershipId,
            },
            metadata: membersRouteMetadata,
            params: {},
            input: undefined,
            handler: async ({ tx, ctx }) => {
              const items = await listMembersForTenant({
                tx,
                tenantId: ctx.tenantId,
                limit: 25,
              });

              return {
                items,
                pageInfo: {
                  nextCursor: null,
                  hasNextPage: false,
                },
              };
            },
          });
        },
      );

      const body = membersListOutputSchema.parse({
        data: result,
      });

      return NextResponse.json(body);
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
