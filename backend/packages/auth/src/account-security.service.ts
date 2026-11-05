import QRCode from "qrcode";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertPasswordNotBreached } from "./password-policy";
import { headers } from "next/headers";
import {
  authRequestContext,
  authRequestContextFromHeaders,
  changeEmailWithBetterAuth,
  changePasswordWithBetterAuth,
  disableTwoFactor,
  enableTwoFactor,
  listTwoFactorFactors,
  verifySecondFactor,
  requestMagicLinkWithBetterAuth,
  listLoginMethods,
  signOutOtherSessionsWithBetterAuth,
  startGoogleLink,
  unlinkLoginMethod,
} from "./better-auth-flows";
import { applySetCookiesToCookieStore } from "./cookie-store";
import type { AuthEmail } from "./better-auth";

function mapAuthError(): never {
  throw new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Unable to complete this security action. Please try again.",
  });
}

async function betterAuthContext() {
  return authRequestContextFromHeaders(new Headers(await headers()));
}

export async function changePassword(args: { currentPassword: string; newPassword: string }) {
  await assertPasswordNotBreached(args.newPassword);
  const { email } = await changePasswordWithBetterAuth({
    ctx: await betterAuthContext(),
    currentPassword: args.currentPassword,
    newPassword: args.newPassword,
  });
  return { ok: true as const, email };
}

export async function changeEmail(args: {
  newEmail: string;
}): Promise<{ ok: true; email: string; emails: AuthEmail[] }> {
  // The route sends these: the current address approves the change first.
  const result = await changeEmailWithBetterAuth({
    ctx: await betterAuthContext(),
    newEmail: args.newEmail,
  });
  return { ok: true as const, email: result.email, emails: result.emails };
}

export async function listMfaFactors() {
  return { factors: await listTwoFactorFactors({ ctx: await betterAuthContext() }) };
}

export async function enrollMfaTotp(args: { password?: string | undefined } = {}) {
  const enabled = await enableTwoFactor({
    ctx: await betterAuthContext(),
    password: args.password,
  });
  return {
    factorId: enabled.factorId,
    // Better Auth gives the otpauth:// URI; the settings page shows a QR image.
    qrCode: await QRCode.toDataURL(enabled.uri, { margin: 1, width: 240 }),
    secret: enabled.secret,
    uri: enabled.uri,
    backupCodes: enabled.backupCodes,
  };
}

/**
 * The Set-Cookie headers for a session that completed MFA (aal2); none when
 * the session was stepped up in place.
 */
export type MfaVerifiedSession = { setCookies: string[] };

/**
 * Verifies a newly enrolled factor. Verification also completes MFA for this
 * session, so the returned aal2 session must replace the caller's cookies:
 * otherwise someone who enrolls in order to reach a step-up action still holds
 * an aal1 session and is challenged again (audit H4).
 */
export async function verifyMfaEnrollment(args: {
  code: string;
}): Promise<{ ok: true; session: MfaVerifiedSession }> {
  const verified = await verifySecondFactor({ ctx: await betterAuthContext(), code: args.code });
  return { ok: true as const, session: verified.cookies };
}

/**
 * Step-up: completes MFA for the current session, returning the aal2 session
 * (audit H4). Routes that declare `mfa: "required"` accept the session from
 * then on. A backup code works here too; the session is marked aal2 in place.
 */
export async function stepUpMfa(args: { code: string }): Promise<{ session: MfaVerifiedSession }> {
  const verified = await verifySecondFactor({ ctx: await betterAuthContext(), code: args.code });
  return { session: verified.cookies };
}

/** One factor per principal: removing it also removes the backup codes. */
export async function unenrollMfaFactor() {
  await disableTwoFactor({ ctx: await betterAuthContext() });
  return { ok: true as const };
}

export async function signOutOtherSessions() {
  await signOutOtherSessionsWithBetterAuth({ ctx: await betterAuthContext() });
  return { ok: true as const };
}

export async function listLinkedIdentities() {
  const methods = await listLoginMethods({ ctx: await betterAuthContext() });
  return {
    identities: methods.map((method) => ({
      id: method.id,
      provider: method.provider,
      email: null,
      createdAt: method.createdAt,
    })),
  };
}

export async function startLinkIdentity(args: { provider: "google" | "apple" }) {
  // Apple is deferred (launch plan, "Later: Apple sign-in").
  if (args.provider !== "google") mapAuthError();
  const start = await startGoogleLink({ ctx: await betterAuthContext() });
  // The signed state cookie Google's callback is checked against.
  await applySetCookiesToCookieStore(start.cookies.setCookies);
  return { url: start.url };
}

export async function unlinkIdentity(args: { identityId: string }) {
  await unlinkLoginMethod({ ctx: await betterAuthContext(), id: args.identityId });
  return { ok: true as const };
}

export async function sendMagicLink(args: {
  email: string;
  req: Request;
}): Promise<{ ok: true; emails: AuthEmail[] }> {
  const { emails } = await requestMagicLinkWithBetterAuth({
    ctx: authRequestContext(args.req),
    email: args.email,
  });
  return { ok: true as const, emails };
}
