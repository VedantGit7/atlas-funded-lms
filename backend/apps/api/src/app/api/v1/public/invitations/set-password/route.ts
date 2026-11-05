import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler, globalDbPerStatement } from "@atlas/api";
import {
  applyAuthSession,
  assertPasswordNotBreached,
  authRequestContext,
  createAccountFromInvitation,
  findActiveSessionPrincipal,
} from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { acceptInvitation, invalidInvitation, previewInvitation } from "@atlas/membership";
import {
  SetInvitationPasswordRequestSchema,
  SetInvitationPasswordResponseSchema,
  rejectClientTenantId,
  readMembershipRoleKeys,
  resolveRoleHomePath,
  resolvePostInviteRedirect,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

/**
 * Completes an invitation for someone who can't sign in yet: they choose a
 * password, and we (1) create their account with it, verified, because the
 * invitation was emailed to that address, (2) activate their membership, and
 * (3) sign them in, so they finish as their own account, never as whoever was
 * signed in on the device before. An address that can already sign in is
 * asked to (launch plan task 3.6).
 *
 * The account and the membership are written in separate transactions, so the
 * membership's foreign key sees the committed auth_principals row.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = SetInvitationPasswordRequestSchema.parse(rawBody);

  const tenant = await withGlobalDb(async (db) => resolveTenantFromRequest({ req, db }));

  const preview = await withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    async (tx) => previewInvitation({ tx, tenantId: tenant.tenantId, token: input.token }),
  );
  if (!preview) throw invalidInvitation();
  await assertPasswordNotBreached(input.password);
  const created = await createAccountFromInvitation({
    ctx: authRequestContext(req),
    email: preview.invitedEmail,
    password: input.password,
  });
  const principal = await findActiveSessionPrincipal({
    db: globalDbPerStatement,
    principalId: created.principalId,
  });

  const result = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      acceptInvitation({
        tx,
        tenantId: tenant.tenantId,
        requestId,
        input: { token: input.token },
        principal,
      }),
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

  const body = SetInvitationPasswordResponseSchema.parse({
    data: {
      status: "ACCEPTED",
      redirectTo: resolvePostInviteRedirect({
        roleHome: resolveRoleHomePath(roleKeys),
        mfaEnabled: principal.mfaEnabled,
      }),
    },
  });

  const response = NextResponse.json(body);

  applyAuthSession({ response, session: created.cookies });

  return response;
});
