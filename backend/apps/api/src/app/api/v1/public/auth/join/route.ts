import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler, requireSessionUser, resolveSessionPrincipal } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicJoinRequestSchema,
  buildPublicAuthResponse,
  rejectClientTenantId,
} from "@atlas/domain-identity";
import { resolveSignInMembership } from "../../../../../../lib/sign-in-membership";
import { routeMetadata } from "./route.metadata";

/**
 * Joins this academy as someone already signed in, by agreeing to its Terms
 * and Privacy Policy (launch plan 5.7). Sign-in sends a person here when they
 * have no membership and gave no agreement (signed in with an account made at
 * another academy, or a sign-up link from before agreement was required), or
 * when their membership was opened before agreement was recorded.
 *
 * The membership is opened, or the existing one confirmed, only now, with the
 * agreement recorded alongside it. A waiting invitation is sent on to its own
 * acceptance page instead.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  PublicJoinRequestSchema.parse(rawBody);

  const tenant = await withGlobalDb(async (db) => resolveTenantFromRequest({ req, db }));
  // A signed-in session that has cleared any second factor.
  const sessionUser = await requireSessionUser(req);
  const principal = await withGlobalDb(async (db) =>
    resolveSessionPrincipal({ db, user: sessionUser }),
  );

  const body = await withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    async (tx) => {
      const { membership, termsRequired } = await resolveSignInMembership(tx, {
        tenantId: tenant.tenantId,
        principalId: principal.id,
        email: principal.emailNormalized,
        provision: true,
        consent: { source: "join", acceptedAt: new Date() },
      });
      return buildPublicAuthResponse({
        tx,
        tenantId: tenant.tenantId,
        serviceStatus: "signed_in",
        mfaEnabled: false,
        membership,
        termsRequired,
      });
    },
  );

  return NextResponse.json(body);
});
