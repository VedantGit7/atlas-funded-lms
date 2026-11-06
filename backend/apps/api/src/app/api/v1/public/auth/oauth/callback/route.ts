import { NextResponse } from "next/server";
import { resolvePlatformHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";
import { createPublicRouteHandler, globalDbPerStatement, resolveRequestTenant } from "@atlas/api";
import { applyAuthSession, authRequestContext, completeGoogleCallback } from "@atlas/auth";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  PublicOAuthCallbackRequestSchema,
  PublicAuthResponseSchema,
  rejectClientTenantId,
  buildPublicAuthResponse,
} from "@atlas/domain-identity";
import { sendAuthEmails } from "../../../../../../../lib/auth-email";
import { resolveSignInMembership } from "../../../../../../../lib/sign-in-membership";
import { routeMetadata } from "./route.metadata";

/** Where a person who linked Google from their security settings goes back to. */
const LINKED_REDIRECT = "/profile/security";

function oauthCallbackInvalid(): AtlasHttpError {
  return new AtlasHttpError({
    code: "AUTH_REQUIRED",
    status: 401,
    message: "Google sign-in did not complete. Please try again.",
  });
}

/**
 * "Keep me signed in" off: drop the session cookie's lifetime so the browser
 * forgets it on close. Better Auth's social sign-in has no rememberMe of its own.
 */
function forBrowserSessionOnly(setCookies: string[]): string[] {
  return setCookies.map((cookie) =>
    /^(__Secure-)?atlas_session=/.test(cookie)
      ? cookie.replace(/;\s*Max-Age=\d+/i, "").replace(/;\s*Expires=[^;]+/i, "")
      : cookie,
  );
}

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const host = resolveRequestHostFromHeaders(req.headers);

  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicOAuthCallbackRequestSchema.parse(rawBody);
  const persistent = input.rememberMe ?? false;

  // The console offers no Google sign-in: its Google clients register academy
  // addresses only.
  if (resolvePlatformHost(host)) throw oauthCallbackInvalid();

  // One pooled connection at a time, none during the provider round trip (audit H3).
  const tenant = await resolveRequestTenant(req);

  const result = await completeGoogleCallback({
    ctx: authRequestContext(req),
    code: input.code,
    state: input.state,
  });
  // A new account from an address Google hasn't verified gets our
  // verification email and no session.
  await sendAuthEmails({ req, requestId, emails: result.emails });

  if (result.kind === "linked") {
    // Google is now a login method of the person already signed in here.
    return NextResponse.json(
      PublicAuthResponseSchema.parse({
        data: { status: "AUTHENTICATED", redirectTo: LINKED_REDIRECT },
      }),
    );
  }
  const principalId = result.principalId;
  const session = {
    setCookies: persistent
      ? result.cookies.setCookies
      : forBrowserSessionOnly(result.cookies.setCookies),
  };

  // A global table: read on its own connection, never inside the tenant
  // transaction. Self-service sign-up needs the normalized email (an
  // invitation is matched by it) and waits for an account with an
  // authenticator to clear its code, which a Google session doesn't.
  const principalRows = await globalDbPerStatement.$queryRaw<
    Array<{ email_normalized: string; mfa_enabled: boolean }>
  >`
    select email_normalized, mfa_enabled
    from auth_principals
    where id = ${principalId}::uuid
    limit 1
  `;
  const principal = principalRows[0];

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const membership = principal
        ? await resolveSignInMembership(tx, {
            tenantId: tenant.tenantId,
            principalId,
            email: principal.email_normalized,
            provision: !principal.mfa_enabled,
          })
        : null;

      return buildPublicAuthResponse({
        tx,
        tenantId: tenant.tenantId,
        serviceStatus: "signed_in",
        // A session from Google is aal1, so routes that need MFA still ask for
        // the code (docs/engineering/better-auth-design.md).
        mfaEnabled: false,
        membership,
      });
    },
  );

  const response = NextResponse.json(body);
  applyAuthSession({ response, session });
  return response;
});
