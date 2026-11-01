import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler, globalDbPerStatement } from "@atlas/api";
import {
  applyAuthSession,
  assertPasswordNotBreached,
  authProvider,
  authRequestContext,
  createAccountFromInvitation,
  findActiveSessionPrincipal,
  setPasswordFromInvitationSession,
  type IssuedAuthSession,
} from "@atlas/auth";
import { AtlasHttpError } from "@atlas/core/http/errors";
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

  let principal: { id: string; emailNormalized: string; mfaEnabled: boolean };
  let session: IssuedAuthSession;
  if (authProvider() === "better-auth") {
    // The invitation itself proves the address: it was emailed there. An
    // address that can already sign in is asked to (launch plan task 3.6).
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
    principal = await findActiveSessionPrincipal({
      db: globalDbPerStatement,
      principalId: created.principalId,
    });
    session = created.cookies;
  } else {
    if (!input.accessToken) {
      throw new AtlasHttpError({
        code: "INVALID_INVITATION",
        status: 400,
        message: "Open the link in your invitation email to set your password.",
      });
    }
    // Supabase round trips run with no pooled connection held (audit H3), and a
    // refused re-registration keeps its relink request for review (audit H6).
    ({ principal, session } = await setPasswordFromInvitationSession({
      db: globalDbPerStatement,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? "",
      password: input.password,
    }));
  }

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

  applyAuthSession({ response, session });

  return response;
});
