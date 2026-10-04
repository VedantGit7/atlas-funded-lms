import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
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
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = AcceptInvitationRequestSchema.parse(rawBody);

  const tenant = await withGlobalDb(async (db) => resolveTenantFromRequest({ req, db }));
  const supabaseUser = await requireSupabaseUser(req);

  const principal = await withGlobalDb(async (db) =>
    upsertAuthPrincipal({
      db,
      supabaseUserId: supabaseUser.supabaseUserId,
      email: supabaseUser.email,
      emailConfirmed: supabaseUser.emailConfirmed,
      mfaEnabled: supabaseUser.mfaEnabled,
      markLogin: false,
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
        principal: {
          id: principal.id,
          emailNormalized: principal.emailNormalized,
        },
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
