import { enforceIngressRateLimit } from "@atlas/api/rate-limit";
import { measureRouteStage } from "@atlas/api/route-stage-timings";
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
import { requireSupabaseUser, toSessionSafeIdentity, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  findMemberProfile,
  listMembershipRoles,
  meMembershipOutputSchema,
  requireActiveMembership,
} from "@atlas/membership";
import { createResourceProjection } from "../../../../server/resource-projection";

const profileProjections =
  createResourceProjection<Awaited<ReturnType<typeof findMemberProfile>>>();

const meRouteMetadata: RouteMetadata = {
  permission: "profile.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  audit: "none",
  resourceLoader: async ({ tx, ctx }) => {
    const profile = await findMemberProfile({
      tx,
      tenantId: ctx.tenantId,
      membershipId: ctx.actorMembershipId,
    });

    const resource = createTenantResourceRef({
      type: "member_profile",
      id: profile?.id ?? ctx.actorMembershipId,
      tenantId: ctx.tenantId,
      ownerMembershipId: ctx.actorMembershipId,
    });
    profileProjections.set(resource, tx, ctx, profile);
    return resource;
  },
};

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

  try {
    await enforceIngressRateLimit({ req, plane: "tenant", requestId });
    // Verify the remote session before acquiring a database connection, then
    // release global identity work before the tenant transaction checks out one.
    const supabaseUser = await measureRouteStage("authentication", () => requireSupabaseUser(req));
    const { tenant, principal } = await measureRouteStage("global_total", () =>
      withGlobalDb((db) =>
        measureRouteStage("global_work", async () => {
          const tenant = await resolveTenantFromRequest({ req, db });
          const principal = await upsertAuthPrincipal({
            db,
            supabaseUserId: supabaseUser.supabaseUserId,
            email: supabaseUser.email,
            emailConfirmed: supabaseUser.emailConfirmed,
            mfaEnabled: supabaseUser.mfaEnabled,
            markLogin: false,
          });
          return { tenant, principal };
        }),
      ),
    );

    const result = await measureRouteStage("tenant_total", () =>
      withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        (tx) =>
          measureRouteStage("tenant_work", async () => {
            const membership = await requireActiveMembership({
              tx,
              tenantId: tenant.tenantId,
              authPrincipalId: principal.id,
            });

            return runProtectedTenantRouteHandler({
              sessionAssuranceLevel: supabaseUser.sessionAssuranceLevel,
              tx,
              ctx: {
                tenantId: tenant.tenantId,
                requestId,
                actorMembershipId: membership.membershipId,
              },
              metadata: meRouteMetadata,
              params: {},
              input: undefined,
              handler: async ({ tx, ctx, resource }) => {
                const loaded = profileProjections.get(resource, tx, ctx);
                const [profile, roles] = await Promise.all([
                  loaded !== undefined
                    ? loaded
                    : findMemberProfile({
                        tx,
                        tenantId: ctx.tenantId,
                        membershipId: ctx.actorMembershipId,
                      }),
                  listMembershipRoles({
                    tx,
                    tenantId: ctx.tenantId,
                    membershipId: ctx.actorMembershipId,
                  }),
                ]);

                return { membership, profile, roles };
              },
            });
          }),
      ),
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
          roleKeys: result.roles.map((role) => role.key),
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
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status, headers: safe.headers ?? {} });
  }
}
