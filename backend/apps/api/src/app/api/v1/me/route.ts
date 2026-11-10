import { enforceIngressRateLimit } from "@atlas/api/rate-limit";
import { measureRouteStage } from "@atlas/api/route-stage-timings";
import { requireSessionUser, resolveSessionPrincipal } from "@atlas/api/session-user";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRecentLookup, resolveTenantFromRequest } from "@atlas/tenancy";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import {
  enforceTenantRouteRateLimit,
  runProtectedTenantRouteHandler,
  toSafeErrorEnvelope,
  type RouteMetadata,
} from "@atlas/api";
import { createTenantResourceRef } from "@atlas/authorization";
import { toSessionSafeIdentity } from "@atlas/auth";
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
    // Verify the remote session before acquiring a database connection. The
    // tenant comes from this process's recent lookups, or from a global
    // transaction released before the tenant transaction checks out one.
    const sessionUser = await measureRouteStage("authentication", () => requireSessionUser(req));
    const tenant =
      resolveTenantFromRecentLookup(req) ??
      (await measureRouteStage("global_total", () =>
        withGlobalDb((db) =>
          measureRouteStage("global_work", () => resolveTenantFromRequest({ req, db })),
        ),
      ));

    await enforceTenantRouteRateLimit({
      tenantId: tenant.tenantId,
      principalId: sessionUser.principalId,
      metadata: meRouteMetadata,
      requestId,
    });

    const result = await measureRouteStage("tenant_total", () =>
      withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        (tx) =>
          measureRouteStage("tenant_work", async () => {
            // The principal is read here, in the tenant transaction, rather than
            // in a global one of its own: three statements fewer on the load
            // test's slowest step (docs/engineering/staging-load-test-2026-11-07.md).
            // It is still read and refused unless active before the membership
            // gate, with the same answers.
            const principal = await resolveSessionPrincipal({ db: tx, user: sessionUser });
            const membership = await requireActiveMembership({
              tx,
              tenantId: tenant.tenantId,
              authPrincipalId: principal.id,
            });

            const handled = await runProtectedTenantRouteHandler({
              sessionAssuranceLevel: sessionUser.sessionAssuranceLevel,
              rateLimitEnforced: true,
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
            return { ...handled, principal };
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
        identity: toSessionSafeIdentity(result.principal),
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
