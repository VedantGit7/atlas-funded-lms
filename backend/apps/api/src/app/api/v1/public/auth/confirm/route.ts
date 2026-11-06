import { NextResponse } from "next/server";
import { createPublicRouteHandler, globalDbPerStatement, resolveRequestTenant } from "@atlas/api";
import { establishSessionFromTokenHash, applyAuthSession } from "@atlas/auth";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicAuthConfirmRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { sendAuthEmails } from "../../../../../../lib/auth-email";
import { resolveSignInMembership } from "../../../../../../lib/sign-in-membership";
import { routeMetadata } from "./route.metadata";

/**
 * Completes email verification for self-service signup. The SSR confirm route
 * forwards the single-use token from the verification link here; we verify it
 * with Better Auth, provision the open learner membership for this tenant, and
 * set the session cookie — the same end state as a first login. Sign-in links
 * and both steps of an email change come here too.
 */
export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  // One pooled connection at a time, none during the verification (audit H3).
  const tenant = await resolveRequestTenant(req);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicAuthConfirmRequestSchema.parse(rawBody);

  const result = await establishSessionFromTokenHash({
    db: globalDbPerStatement,
    tokenHash: input.tokenHash,
    type: input.type,
    req,
  });

  // The current address approved an email change, and the new address is sent
  // its verification link. Nothing is signed in yet.
  if (result.status === "email_change_pending") {
    await sendAuthEmails({ req, requestId, emails: result.emails });
    return NextResponse.json(
      PublicAuthResponseSchema.parse({
        data: { status: "EMAIL_VERIFICATION_REQUIRED", redirectTo: null },
      }),
    );
  }
  if (result.emails.length) await sendAuthEmails({ req, requestId, emails: result.emails });

  const principalRows = await globalDbPerStatement.$queryRaw<{ id: string }[]>`
    select id::text
    from auth_principals
    where email_normalized = ${result.identity.emailNormalized}
    limit 1
  `;
  const principalId = principalRows[0]?.id;

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const membership = await resolveSignInMembership(tx, {
        tenantId: tenant.tenantId,
        principalId,
        email: result.identity.emailNormalized,
        provision: !result.identity.mfaEnabled,
      });

      return buildPublicAuthResponse({
        tx,
        tenantId: tenant.tenantId,
        serviceStatus: result.status,
        mfaEnabled: result.identity.mfaEnabled,
        membership,
      });
    },
  );

  const response = NextResponse.json(body);

  applyAuthSession({ response, session: result.session });

  return response;
});
