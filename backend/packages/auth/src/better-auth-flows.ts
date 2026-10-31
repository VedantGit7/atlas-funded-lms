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
import type { AuthEmail } from "./better-auth";
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
}): Promise<{ principalId: string | null; cookies: BetterAuthCookies }> {
  const auth = getAtlasAuth();
  let cookies: BetterAuthCookies;
  try {
    const { headers } = await auth.api.verifyEmail({
      query: { token: args.token },
      headers: headersFor(args.ctx),
      returnHeaders: true,
    });
    cookies = cookiesFrom(headers);
  } catch {
    // Expired or forged: the same answer as Supabase's verifyOtp failure.
    throw invalidCredentials();
  }

  const sessionCookie = cookies.setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
  if (!sessionCookie) return { principalId: null, cookies };
  const session = await auth.api.getSession({
    headers: headersFor({ ...args.ctx, cookie: sessionCookie }),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  return { principalId: session?.user.id ?? null, cookies };
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
