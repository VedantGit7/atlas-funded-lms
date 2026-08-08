import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { setAuthCookies, setPasswordFromInvitationSession } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { acceptInvitation } from "@atlas/membership";
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
 * Completes an invitation: the invitee arrives with the session minted by the
 * invitation email link, chooses a password, and we (1) set that password on
 * their account, (2) activate their membership, and (3) issue Atlas session
 * cookies — so they finish fully signed in as their own account, never as
 * whoever was previously signed in on the device.
 *
 * Global principal upsert and tenant membership activation run in separate
 * transactions so the membership FK can see the committed auth_principals row.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = SetInvitationPasswordRequestSchema.parse(rawBody);

  const tenant = await withGlobalDb(async (db) => resolveTenantFromRequest({ req, db }));

  const { principal, session } = await withGlobalDb(async (db) =>
    setPasswordFromInvitationSession({
      db,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? "",
      password: input.password,
    }),
  );

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

  setAuthCookies({
    response,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresInSeconds: session.expiresIn,
  });

  return response;
});
