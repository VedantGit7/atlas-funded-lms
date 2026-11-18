import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler, requireSessionUser, resolveSessionPrincipal } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { acceptInvitation } from "@atlas/membership";
import {
  AcceptInvitationRequestSchema,
  AcceptInvitationResponseSchema,
  rejectClientTenantId,
  readMembershipRoleKeys,
  resolveRoleHomePath,
  resolvePostInviteRedirect,
} from "@atlas/domain-identity";
import { recordLegalAcceptance } from "../../../../../../server/tenant-settings/legal-acceptance.service";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = AcceptInvitationRequestSchema.parse(rawBody);

  const tenant = await withGlobalDb(async (db) => resolveTenantFromRequest({ req, db }));
  const sessionUser = await requireSessionUser(req);

  const principal = await withGlobalDb(async (db) =>
    resolveSessionPrincipal({
      db,
      user: sessionUser,
    }),
  );

  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const accepted = await acceptInvitation({
        tx,
        tenantId: tenant.tenantId,
        requestId,
        input: { token: input.token },
        principal: {
          id: principal.id,
          emailNormalized: principal.emailNormalized,
        },
      });
      // The schema only admits an acceptance whose "I agree" box was ticked
      // (launch plan 5.7); it is recorded with the membership it opens.
      await recordLegalAcceptance(tx, {
        tenantId: tenant.tenantId,
        membershipId: accepted.membership.id,
        consent: { source: "invitation", acceptedAt: new Date() },
      });
      return accepted;
    },
  );

  const roleKeys = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      readMembershipRoleKeys({
        tx,
        tenantId: tenant.tenantId,
        membershipId: result.membership.id,
      }),
  );

  const body = AcceptInvitationResponseSchema.parse({
    data: {
      status: "ACCEPTED",
      redirectTo: resolvePostInviteRedirect({
        roleHome: resolveRoleHomePath(roleKeys),
        mfaEnabled: principal.mfaEnabled,
      }),
    },
  });

  return NextResponse.json(body);
});
