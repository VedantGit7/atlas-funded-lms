import { isAPIError } from "better-auth/api";
import { resolveRequestHostFromHeaders } from "@atlas/tenancy";

import {
  accountDisabled,
  authProviderUnavailable,
  authRequired,
  emailNotVerified,
  invalidCredentials,
  PASSWORD_POLICY_REJECTION_MESSAGE,
  signInRateLimited,
} from "./auth-errors";
import {
  OAUTH_DONE_PATH,
  OAUTH_ERROR_PATH,
  OAUTH_LINKED_PATH,
  type AuthEmail,
} from "./better-auth";
import {
  betterAuthHeaders,
  captureAuthEmails,
  forgetBetterAuthSession,
  getAtlasAuth,
} from "./better-auth-runtime";
import { readRequestCookieHeader } from "./cookie-names";
import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Better Auth versions of the password flows (launch plan task 3.2;
 * docs/engineering/better-auth-design.md). Each answers like the Supabase flow
 * it replaces, so the routes keep their responses, and returns the cookies
 * Better Auth set for the route to pass on.
 */

/** Cookies for the route to set: the session, or a pending two-factor challenge. */
export type BetterAuthCookies = { setCookies: string[] };

export type AuthRequestContext = {
  host: string;
  cookie: string | null;
  userAgent: string | null;
};

export function authRequestContext(req: Request): AuthRequestContext {
  return {
    host: resolveRequestHostFromHeaders(req.headers),
    cookie: readRequestCookieHeader(req),
    userAgent: req.headers.get("user-agent"),
  };
}

/** The same, for code that has only the incoming headers (route handlers' next/headers). */
export function authRequestContextFromHeaders(headers: Headers): AuthRequestContext {
  return authRequestContext(new Request("http://localhost/", { headers }));
}

function headersFor(ctx: AuthRequestContext): Headers {
  return betterAuthHeaders(ctx);
}

function cookiesFrom(headers: Headers): BetterAuthCookies {
  return { setCookies: headers.getSetCookie() };
}

function errorCode(error: unknown): string | undefined {
  if (!isAPIError(error)) return undefined;
  const body = error.body as { code?: unknown } | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

function statusOf(error: unknown): number | undefined {
  return isAPIError(error) ? error.statusCode : undefined;
}

/** Better Auth's own length rule, worded as ours (`password-policy.ts`). */
function passwordRejected(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: PASSWORD_POLICY_REJECTION_MESSAGE,
  });
}

const WEAK_PASSWORD_CODES = new Set(["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"]);

type PrincipalStatusRow = { id: string; global_status: string; mfa_enabled: boolean };

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

async function principalByEmail(db: QueryableDb, email: string) {
  const rows = await db.$queryRaw<PrincipalStatusRow[]>`
    select id::text, global_status, mfa_enabled
    from auth_principals
    where email_normalized = ${email.trim().toLowerCase()}
    limit 1
  `;
  return rows[0] ?? null;
}

export type BetterAuthSignIn =
  | { status: "signed_in"; principalId: string; cookies: BetterAuthCookies }
  | { status: "mfa_required"; principalId: string; cookies: BetterAuthCookies };

export async function signInWithBetterAuth(args: {
  db: QueryableDb;
  ctx: AuthRequestContext;
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<BetterAuthSignIn> {
  try {
    const { headers, response } = await getAtlasAuth().api.signInEmail({
      body: { email: args.email, password: args.password, rememberMe: args.rememberMe },
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    if ("twoFactorRedirect" in response && response.twoFactorRedirect) {
      const principal = await principalByEmail(args.db, args.email);
      if (!principal) throw invalidCredentials();
      return { status: "mfa_required", principalId: principal.id, cookies: cookiesFrom(headers) };
    }
    if (!("user" in response)) throw invalidCredentials();
    return { status: "signed_in", principalId: response.user.id, cookies: cookiesFrom(headers) };
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    const code = errorCode(error);
    const status = statusOf(error);
    if (code === "EMAIL_NOT_VERIFIED") throw emailNotVerified();
    if (status === 429) throw signInRateLimited();
    if (status === 401 || code === "INVALID_EMAIL_OR_PASSWORD") throw invalidCredentials();
    // The session hook refuses a disabled principal; say so, as Supabase sign-in does.
    const principal = await principalByEmail(args.db, args.email).catch(() => null);
    if (principal && principal.global_status === "disabled") throw accountDisabled();
    throw authProviderUnavailable();
  }
}

export type BetterAuthSignUp = { status: "verification_required"; emails: AuthEmail[] };

/**
 * Signs up and asks for the verification email. The answer is the same whether
 * or not the address already has an account, so it can't be used to probe
 * accounts. An unclaimed placeholder (audit H6) gets the password and the
 * email; it becomes active when its owner signs in with the proven address.
 */
export async function signUpWithBetterAuth(args: {
  db: QueryableDb;
  ctx: AuthRequestContext;
  email: string;
  password: string;
  displayName?: string;
}): Promise<BetterAuthSignUp> {
  const auth = getAtlasAuth();
  const existing = await principalByEmail(args.db, args.email);

  if (existing?.global_status === "unclaimed") {
    const { emails } = await captureAuthEmails(async () => {
      const context = await auth.$context;
      const accounts = await context.internalAdapter.findAccounts(existing.id);
      if (!accounts.some((account) => account.providerId === "credential")) {
        await context.internalAdapter.linkAccount({
          userId: existing.id,
          providerId: "credential",
          accountId: existing.id,
          password: await context.password.hash(args.password),
        });
      }
      await auth.api.sendVerificationEmail({
        body: { email: args.email },
        headers: headersFor(args.ctx),
      });
    });
    return { status: "verification_required", emails };
  }

  if (existing) {
    // Already registered: no email, and the same answer as a new address.
    return { status: "verification_required", emails: [] };
  }

  try {
    const { emails } = await captureAuthEmails(() =>
      auth.api.signUpEmail({
        body: { email: args.email, password: args.password, name: args.displayName ?? "" },
        headers: headersFor(args.ctx),
      }),
    );
    return { status: "verification_required", emails };
  } catch (error) {
    const code = errorCode(error);
    if (code && WEAK_PASSWORD_CODES.has(code)) throw passwordRejected();
    // Lost a race with another sign-up for the same address.
    if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return { status: "verification_required", emails: [] };
    }
    if (statusOf(error) === 429) throw signInRateLimited();
    throw authProviderUnavailable();
  }
}

/**
 * Opens a verification link: marks the email verified and signs the person in.
 * Better Auth answers `user: null` and signs in only through the cookie it
 * sets, so the principal is read back from that session. A link that was
 * already used verifies nothing and sets no cookie.
 */
export async function verifyEmailWithBetterAuth(args: {
  ctx: AuthRequestContext;
  token: string;
}): Promise<{ principalId: string | null; cookies: BetterAuthCookies; emails: AuthEmail[] }> {
  const auth = getAtlasAuth();
  let cookies: BetterAuthCookies;
  let emails: AuthEmail[];
  try {
    // The approval step of an email change asks for one more email: the
    // verification link for the new address.
    const captured = await captureAuthEmails(() =>
      auth.api.verifyEmail({
        query: { token: args.token },
        headers: headersFor(args.ctx),
        returnHeaders: true,
      }),
    );
    cookies = cookiesFrom(captured.result.headers);
    emails = captured.emails;
  } catch {
    // Expired or forged: the same answer as Supabase's verifyOtp failure.
    throw invalidCredentials();
  }
  return { principalId: await sessionPrincipal(args.ctx, cookies), cookies, emails };
}

/** The principal of the session a Better Auth response just set, if it set one. */
async function sessionPrincipal(
  ctx: AuthRequestContext,
  cookies: BetterAuthCookies,
): Promise<string | null> {
  const sessionCookie = cookies.setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
  if (!sessionCookie) return null;
  const session = await getAtlasAuth().api.getSession({
    headers: headersFor({ ...ctx, cookie: sessionCookie }),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  return session?.user.id ?? null;
}

/**
 * Emails a sign-in link (launch plan task 3.4). Existing accounts only, and
 * the same answer either way: an unknown address gets nothing.
 */
export async function requestMagicLinkWithBetterAuth(args: {
  ctx: AuthRequestContext;
  email: string;
}): Promise<{ emails: AuthEmail[] }> {
  try {
    // Better Auth sends the link to any address and refuses it only when it's
    // opened (disableSignUp), which would let anyone have us email anyone.
    const context = await getAtlasAuth().$context;
    if (!(await context.internalAdapter.findUserByEmail(args.email))) return { emails: [] };

    const { emails } = await captureAuthEmails(() =>
      getAtlasAuth().api.signInMagicLink({
        body: { email: args.email, callbackURL: OAUTH_DONE_PATH },
        headers: headersFor(args.ctx),
      }),
    );
    return { emails };
  } catch {
    return { emails: [] };
  }
}

/**
 * Opens a sign-in link: Better Auth checks the single-use token, marks the
 * address verified, and starts an aal1 session, which the session hook may
 * refuse (a disabled principal) or use to claim a placeholder (audit H6).
 */
export async function verifyMagicLinkWithBetterAuth(args: {
  ctx: AuthRequestContext;
  token: string;
}): Promise<{ principalId: string; cookies: BetterAuthCookies }> {
  let response: Response;
  try {
    response = await getAtlasAuth().api.magicLinkVerify({
      query: {
        token: args.token,
        callbackURL: OAUTH_DONE_PATH,
        errorCallbackURL: OAUTH_ERROR_PATH,
      },
      headers: headersFor(args.ctx),
      asResponse: true,
    });
  } catch {
    throw invalidCredentials();
  }
  const target = new URL(response.headers.get("location") ?? "", "http://callback.invalid");
  const cookies = cookiesFrom(response.headers);
  const principalId =
    target.pathname === OAUTH_DONE_PATH ? await sessionPrincipal(args.ctx, cookies) : null;
  // Expired, used, or forged, or no session for this principal.
  if (!principalId) throw invalidCredentials();
  return { principalId, cookies };
}

/**
 * Starts an email change: the current address gets a link to approve it, and
 * only then is the new address sent its own verification link. The answer is
 * the same when the new address already has an account, which gets nothing.
 */
export async function changeEmailWithBetterAuth(args: {
  ctx: AuthRequestContext;
  newEmail: string;
}): Promise<{ email: string; emails: AuthEmail[] }> {
  const auth = getAtlasAuth();
  const current = await auth.api.getSession({
    headers: headersFor(args.ctx),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!current) throw authRequired();
  try {
    const { emails } = await captureAuthEmails(() =>
      auth.api.changeEmail({
        body: { newEmail: args.newEmail, callbackURL: "/" },
        headers: headersFor(args.ctx),
      }),
    );
    return { email: current.user.email, emails };
  } catch {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unable to complete this security action. Please try again.",
    });
  }
}

/** Uniform, like Supabase's resend: never says whether the address exists. */
export async function resendVerificationWithBetterAuth(args: {
  ctx: AuthRequestContext;
  email: string;
}): Promise<{ emails: AuthEmail[] }> {
  try {
    const { emails } = await captureAuthEmails(() =>
      getAtlasAuth().api.sendVerificationEmail({
        body: { email: args.email },
        headers: headersFor(args.ctx),
      }),
    );
    return { emails };
  } catch {
    return { emails: [] };
  }
}

/** Uniform: Better Auth answers the same for an unknown address and sends nothing. */
export async function requestPasswordResetWithBetterAuth(args: {
  ctx: AuthRequestContext;
  email: string;
}): Promise<{ emails: AuthEmail[] }> {
  try {
    const { emails } = await captureAuthEmails(() =>
      getAtlasAuth().api.requestPasswordReset({
        body: { email: args.email },
        headers: headersFor(args.ctx),
      }),
    );
    return { emails };
  } catch {
    return { emails: [] };
  }
}

/**
 * Sets a new password from a reset link. Every session ends
 * (`revokeSessionsOnPasswordReset`), and no new one starts: an account with an
 * authenticator still needs its code to sign in. Returns who it was, for the
 * security email.
 */
export async function resetPasswordWithBetterAuth(args: {
  ctx: AuthRequestContext;
  token: string;
  password: string;
}): Promise<{ principalId: string; email: string }> {
  const auth = getAtlasAuth();
  const context = await auth.$context;
  const pending = await context.internalAdapter.findVerificationValue(
    `reset-password:${args.token}`,
  );
  const principal = pending ? await context.internalAdapter.findUserById(pending.value) : null;
  if (!pending || !principal || new Date(pending.expiresAt) <= new Date()) throw authRequired();

  try {
    await auth.api.resetPassword({
      body: { newPassword: args.password, token: args.token },
      headers: headersFor(args.ctx),
    });
  } catch (error) {
    const code = errorCode(error);
    if (code && WEAK_PASSWORD_CODES.has(code)) throw passwordRejected();
    throw authRequired();
  }
  return { principalId: principal.id, email: principal.email };
}

/**
 * Checks the current password, sets the new one, and ends the person's other
 * sessions. This session keeps its token, so its cookie stays valid: Better
 * Auth's own revokeOtherSessions option would replace it with a new one.
 */
export async function changePasswordWithBetterAuth(args: {
  ctx: AuthRequestContext;
  currentPassword: string;
  newPassword: string;
}): Promise<{ email: string }> {
  const auth = getAtlasAuth();
  try {
    const response = await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
        revokeOtherSessions: false,
      },
      headers: headersFor(args.ctx),
    });
    await auth.api.revokeOtherSessions({ headers: headersFor(args.ctx) });
    return { email: response.user.email };
  } catch (error) {
    const code = errorCode(error);
    if (code && WEAK_PASSWORD_CODES.has(code)) throw passwordRejected();
    if (statusOf(error) === 401 && code !== "INVALID_PASSWORD") throw authRequired();
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unable to complete this security action. Please try again.",
    });
  }
}

/** Ends this session in the database; the route clears the cookies either way. */
export async function signOutWithBetterAuth(args: {
  ctx: AuthRequestContext;
}): Promise<BetterAuthCookies> {
  forgetBetterAuthSession(args.ctx.cookie);
  try {
    const { headers } = await getAtlasAuth().api.signOut({
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    return cookiesFrom(headers);
  } catch {
    return { setCookies: [] };
  }
}

/**
 * Google sign-in and login-method linking (launch plan task 3.3). Google sends
 * the person back to /auth/callback/google on the academy's host; the web app
 * passes the code, the state and Better Auth's signed state cookie here.
 */
export type SocialStart = { url: string; cookies: BetterAuthCookies };

export async function startGoogleSignIn(args: { ctx: AuthRequestContext }): Promise<SocialStart> {
  try {
    const { headers, response } = await getAtlasAuth().api.signInSocial({
      body: {
        provider: "google",
        callbackURL: OAUTH_DONE_PATH,
        errorCallbackURL: OAUTH_ERROR_PATH,
        disableRedirect: true,
      },
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    if (!("url" in response) || !response.url) throw authProviderUnavailable();
    return { url: response.url, cookies: cookiesFrom(headers) };
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    // Google isn't configured for this environment, or Better Auth refused.
    throw authProviderUnavailable();
  }
}

/** Starts linking Google to the signed-in principal; the callback adds the login method. */
export async function startGoogleLink(args: { ctx: AuthRequestContext }): Promise<SocialStart> {
  try {
    const { headers, response } = await getAtlasAuth().api.linkSocialAccount({
      body: {
        provider: "google",
        callbackURL: OAUTH_LINKED_PATH,
        errorCallbackURL: OAUTH_ERROR_PATH,
        disableRedirect: true,
      },
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    if (!response.url) throw authProviderUnavailable();
    return { url: response.url, cookies: cookiesFrom(headers) };
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    if (statusOf(error) === 401) throw authRequired();
    throw authProviderUnavailable();
  }
}

export type GoogleCallback =
  | { kind: "signed_in"; principalId: string; cookies: BetterAuthCookies; emails: AuthEmail[] }
  | { kind: "linked"; cookies: BetterAuthCookies; emails: AuthEmail[] };

/** The reason Better Auth gave, as a stable error for the web app's sign-in page. */
function socialSignInRefused(reason: string): AtlasHttpError {
  if (reason === "email_not_verified") return emailNotVerified();
  return new AtlasHttpError({
    code: reason === "account_not_linked" ? "ACCOUNT_NOT_LINKED" : "AUTH_REQUIRED",
    status: reason === "account_not_linked" ? 409 : 401,
    message:
      reason === "account_not_linked"
        ? "This email already has an account. Sign in with your password, then connect Google from your security settings."
        : "Google sign-in did not complete. Please try again.",
  });
}

/**
 * Finishes a Google redirect: Better Auth checks the state against its signed
 * cookie, exchanges the code, then signs in, links to a matching verified
 * account, creates one, or links Google to the person who started a link. It
 * answers with a redirect to one of our marker paths, which says which.
 */
export async function completeGoogleCallback(args: {
  ctx: AuthRequestContext;
  code: string;
  state: string;
}): Promise<GoogleCallback> {
  const auth = getAtlasAuth();
  const { result: response, emails } = await captureAuthEmails(() =>
    auth.api.callbackOAuth({
      method: "GET",
      params: { id: "google" },
      query: { code: args.code, state: args.state },
      headers: headersFor(args.ctx),
      asResponse: true,
    }),
  );
  const location = response.headers.get("location") ?? "";
  const target = new URL(location, "http://callback.invalid");
  const cookies = cookiesFrom(response.headers);

  if (target.pathname === OAUTH_LINKED_PATH) return { kind: "linked", cookies, emails };
  if (target.pathname !== OAUTH_DONE_PATH) {
    throw socialSignInRefused(target.searchParams.get("error") ?? "unknown");
  }

  const sessionCookie = cookies.setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
  const session = sessionCookie
    ? await auth.api.getSession({
        headers: headersFor({ ...args.ctx, cookie: sessionCookie }),
        query: { disableCookieCache: true, disableRefresh: true },
      })
    : null;
  if (!session) throw socialSignInRefused("unable_to_create_session");
  return { kind: "signed_in", principalId: session.user.id, cookies, emails };
}

export type LoginMethod = { id: string; provider: string; createdAt: string | null };

/** The principal's login methods; the password one reads as "email", as with Supabase. */
export async function listLoginMethods(args: { ctx: AuthRequestContext }): Promise<LoginMethod[]> {
  try {
    const accounts = await getAtlasAuth().api.listUserAccounts({ headers: headersFor(args.ctx) });
    return accounts.map((account) => ({
      id: account.id,
      provider: account.providerId === "credential" ? "email" : account.providerId,
      createdAt: new Date(account.createdAt).toISOString(),
    }));
  } catch (error) {
    if (statusOf(error) === 401) throw authRequired();
    throw authProviderUnavailable();
  }
}

/**
 * Removes a login method. Better Auth refuses to remove the last one, so a
 * person can always sign in.
 */
export async function unlinkLoginMethod(args: {
  ctx: AuthRequestContext;
  id: string;
}): Promise<void> {
  const methods = await listLoginMethods({ ctx: args.ctx });
  if (!methods.some((method) => method.id === args.id)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Unable to complete this security action. Please try again.",
    });
  }
  try {
    await getAtlasAuth().api.unlinkAccount({
      body: { accountId: args.id },
      headers: headersFor(args.ctx),
    });
  } catch (error) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message:
        errorCode(error) === "FAILED_TO_UNLINK_LAST_ACCOUNT"
          ? "This is your only way to sign in. Add another before removing it."
          : "Unable to complete this security action. Please try again.",
    });
  }
}

/**
 * Two-factor with an authenticator app and backup codes (launch plan task
 * 3.5). Better Auth keeps one factor per principal in auth_two_factors.
 */
export type TwoFactorFactor = {
  id: string;
  factorType: "totp";
  status: "verified" | "unverified";
  friendlyName: string;
};

async function currentSession(ctx: AuthRequestContext) {
  const session = await getAtlasAuth().api.getSession({
    headers: headersFor(ctx),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session) throw authRequired();
  return session;
}

type TwoFactorRow = { id: string; verified?: boolean | null };

async function twoFactorRow(principalId: string): Promise<TwoFactorRow | null> {
  const context = await getAtlasAuth().$context;
  return context.adapter.findOne<TwoFactorRow>({
    model: "twoFactor",
    where: [{ field: "userId", value: principalId }],
  });
}

export async function listTwoFactorFactors(args: {
  ctx: AuthRequestContext;
}): Promise<TwoFactorFactor[]> {
  const session = await currentSession(args.ctx);
  const row = await twoFactorRow(session.user.id);
  if (!row) return [];
  return [
    {
      id: row.id,
      factorType: "totp",
      status: row.verified === false ? "unverified" : "verified",
      friendlyName: "Authenticator app",
    },
  ];
}

function mfaCodeRejected(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "That code didn't work. Check your authenticator app and try again.",
  });
}

/**
 * Starts setting up an authenticator: a new secret and ten backup codes, both
 * encrypted at rest. An account that signs in with a password confirms it
 * first; one that only uses Google isn't asked (allowPasswordless).
 */
export async function enableTwoFactor(args: {
  ctx: AuthRequestContext;
  password?: string | undefined;
}): Promise<{ factorId: string; uri: string; secret: string; backupCodes: string[] }> {
  const session = await currentSession(args.ctx);
  let response: { totpURI: string; backupCodes: string[] };
  try {
    const enabled = await getAtlasAuth().api.enableTwoFactor({
      body: { ...(args.password ? { password: args.password } : {}) },
      headers: headersFor(args.ctx),
    });
    // The email-code method isn't configured, so this is always TOTP.
    if (!("totpURI" in enabled)) throw authProviderUnavailable();
    response = enabled;
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    const code = errorCode(error);
    if (code === "INVALID_PASSWORD") {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Enter your current password to set up an authenticator app.",
      });
    }
    if (code === "TOTP_ALREADY_ENABLED") {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 409,
        message: "An authenticator app is already set up. Remove it first to set up another.",
      });
    }
    throw authProviderUnavailable();
  }
  const row = await twoFactorRow(session.user.id);
  if (!row) throw authProviderUnavailable();
  return {
    factorId: row.id,
    uri: response.totpURI,
    secret: new URL(response.totpURI).searchParams.get("secret") ?? "",
    backupCodes: response.backupCodes,
  };
}

/** Six digits from the app, or a backup code. */
export function isAuthenticatorCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/**
 * Checks an authenticator or backup code in any of the three places it's
 * asked for, and leaves an aal2 session behind:
 *
 * - finishing setup: Better Auth replaces the session with a new one, which
 *   the session hook marks aal2;
 * - signing in: a pending challenge (Better Auth's two_factor cookie) becomes
 *   an aal2 session the same way;
 * - stepping up: Better Auth accepts the code but changes nothing, so this
 *   session is marked aal2 here (audit H4).
 *
 * Returns the cookies to set; none when the session was stepped up in place.
 */
export async function verifySecondFactor(args: {
  ctx: AuthRequestContext;
  code: string;
}): Promise<{ cookies: BetterAuthCookies; principalId: string }> {
  const auth = getAtlasAuth();
  const code = args.code.trim();
  let headers: Headers;
  try {
    const result = isAuthenticatorCode(code)
      ? await auth.api.verifyTOTP({
          body: { code },
          headers: headersFor(args.ctx),
          returnHeaders: true,
        })
      : await auth.api.verifyBackupCode({
          body: { code },
          headers: headersFor(args.ctx),
          returnHeaders: true,
        });
    headers = result.headers;
  } catch (error) {
    if (statusOf(error) === 429 || errorCode(error) === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
      throw signInRateLimited();
    }
    throw mfaCodeRejected();
  }

  const cookies = cookiesFrom(headers);
  const newSession = cookies.setCookies.some((cookie) =>
    /^(__Secure-)?atlas_session=[^;]+/.test(cookie),
  );
  if (newSession) {
    const principalId = await sessionPrincipal(args.ctx, cookies);
    if (!principalId) throw mfaCodeRejected();
    forgetBetterAuthSession(args.ctx.cookie);
    return { cookies, principalId };
  }

  // Step-up: the same session, now past a second factor.
  const session = await currentSession(args.ctx);
  const context = await auth.$context;
  await context.internalAdapter.updateSession(session.session.token, {
    assuranceLevel: "aal2",
    mfaVerifiedAt: new Date(),
  });
  forgetBetterAuthSession(args.ctx.cookie);
  return { cookies: { setCookies: [] }, principalId: session.user.id };
}

/**
 * Removes the authenticator and backup codes. Asked for from an aal2 session
 * only: the client opens the step-up dialog on MFA_REQUIRED, as for other
 * sensitive actions (audit H4), so a stolen password alone can't remove it.
 */
export async function disableTwoFactor(args: { ctx: AuthRequestContext }): Promise<void> {
  const session = await currentSession(args.ctx);
  if (session.session.assuranceLevel !== "aal2") {
    throw new AtlasHttpError({
      code: "MFA_REQUIRED",
      status: 403,
      message: "Confirm with your authenticator app to continue.",
    });
  }
  const context = await getAtlasAuth().$context;
  await context.adapter.deleteMany({
    model: "twoFactor",
    where: [{ field: "userId", value: session.user.id }],
  });
  await context.internalAdapter.updateUser(session.user.id, { twoFactorEnabled: false });
  forgetBetterAuthSession(args.ctx.cookie);
}

/**
 * Whether an invited address can already sign in (launch plan task 3.6). The
 * invitation page asks for a password when it can't, and to sign in when it can.
 */
export async function invitedAccountState(email: string): Promise<"none" | "exists"> {
  const context = await getAtlasAuth().$context;
  const found = await context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  return found && found.accounts.length > 0 ? "exists" : "none";
}

/**
 * Finishes an invitation for someone who can't sign in yet: the invitation
 * link was sent to this address, which proves it, so the account is created
 * verified (or, for a principal with no login method, such as an unclaimed
 * placeholder, given one), with the chosen password, and signed in.
 * An address that can already sign in is refused: that person signs in and
 * accepts, so nobody's password is replaced from an invitation.
 */
export async function createAccountFromInvitation(args: {
  ctx: AuthRequestContext;
  email: string;
  password: string;
}): Promise<{ principalId: string; cookies: BetterAuthCookies }> {
  const auth = getAtlasAuth();
  const context = await auth.$context;
  const found = await context.internalAdapter.findUserByEmail(args.email, {
    includeAccounts: true,
  });
  if (found && found.accounts.length > 0) {
    throw new AtlasHttpError({
      code: "ALREADY_MEMBER",
      status: 409,
      message: "This email already has an account. Sign in to accept the invitation.",
    });
  }

  const user =
    found?.user ??
    (await context.internalAdapter.createUser(
      { email: args.email, name: "", emailVerified: true },
      // An academy invitation, accepted by setting a password.
      { method: "email-password" },
    ));
  if (!user.emailVerified) {
    await context.internalAdapter.updateUser(user.id, { emailVerified: true });
  }
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(args.password),
  });

  try {
    const { headers } = await auth.api.signInEmail({
      body: { email: args.email, password: args.password, rememberMe: true },
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    return { principalId: user.id, cookies: cookiesFrom(headers) };
  } catch {
    // A disabled principal, or one awaiting a platform decision: refused here as at sign-in.
    throw accountDisabled();
  }
}
