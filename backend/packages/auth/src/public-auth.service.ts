import type { PublicLoginInput, PublicSignupInput } from "./schemas";
import { invalidCredentials } from "./auth-errors";
import { findActiveSessionPrincipal } from "./auth-principal.repository";
import {
  authRequestContext,
  resendVerificationWithBetterAuth,
  signInWithBetterAuth,
  signUpWithBetterAuth,
  verifyEmailWithBetterAuth,
  verifyMagicLinkWithBetterAuth,
} from "./better-auth-flows";
import type { AuthEmail } from "./better-auth";
import { toSessionSafeIdentity } from "./auth-principal.service";
import { assertPasswordNotBreached } from "./password-policy";

type QueryableDb = Parameters<typeof findActiveSessionPrincipal>[0]["db"];

/** What an email link is for, as the confirm page passes it on. */
export type EmailLinkType =
  | "signup"
  | "email"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change";

export async function loginWithPassword(args: {
  db: QueryableDb;
  input: PublicLoginInput & { rememberMe?: boolean | undefined };
  /** Its cookies and host: Better Auth answers for the academy it came to. */
  req: Request;
}) {
  const signIn = await signInWithBetterAuth({
    db: args.db,
    ctx: authRequestContext(args.req),
    email: args.input.email,
    password: args.input.password,
    rememberMe: args.input.rememberMe ?? false,
  });
  const principal = await findActiveSessionPrincipal({
    db: args.db,
    principalId: signIn.principalId,
  });
  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    session: signIn.cookies,
  };
}

/**
 * Creates the account and asks for its address to be verified. A principal is
 * only created for an address its owner has proven (audit H6), so nobody is
 * signed in until the link is opened; the route sends the email.
 */
export async function signupWithPassword(args: {
  db: QueryableDb;
  input: PublicSignupInput;
  req: Request;
}): Promise<{ status: "verification_required"; emails: AuthEmail[] }> {
  await assertPasswordNotBreached(args.input.password);
  const result = await signUpWithBetterAuth({
    db: args.db,
    ctx: authRequestContext(args.req),
    email: args.input.email,
    password: args.input.password,
    ...(args.input.displayName ? { displayName: args.input.displayName.trim() } : {}),
  });
  return { status: "verification_required" as const, emails: result.emails };
}

/**
 * Signs in from an email link: a sign-in link, a new account's verification,
 * or either step of an email change. The token is single-use and checked by
 * Better Auth; the session is set by cookie, never carried in the URL.
 */
export async function establishSessionFromTokenHash(args: {
  db: QueryableDb;
  tokenHash: string;
  type: EmailLinkType;
  req: Request;
}) {
  const ctx = authRequestContext(args.req);

  // A sign-in link (launch plan task 3.4).
  if (args.type === "magiclink" || args.type === "email") {
    const signedIn = await verifyMagicLinkWithBetterAuth({ ctx, token: args.tokenHash });
    const principal = await findActiveSessionPrincipal({
      db: args.db,
      principalId: signedIn.principalId,
    });
    return {
      status: "signed_in" as const,
      identity: toSessionSafeIdentity(principal),
      session: signedIn.cookies,
      emails: [] as AuthEmail[],
    };
  }

  // A new account's address, or either step of an email change.
  const verified = await verifyEmailWithBetterAuth({ ctx, token: args.tokenHash });
  if (!verified.principalId) {
    // The current address approved an email change; the new one is next.
    if (verified.emails.length > 0) {
      return { status: "email_change_pending" as const, emails: verified.emails };
    }
    throw invalidCredentials();
  }
  const principal = await findActiveSessionPrincipal({
    db: args.db,
    principalId: verified.principalId,
  });
  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    session: verified.cookies,
    emails: verified.emails,
  };
}

/**
 * Re-sends the sign-up verification email. Anti-enumeration: the outcome is
 * uniform whether or not the address exists or is already verified, so the
 * response can't be used to probe accounts.
 */
export async function resendSignupVerification(args: {
  email: string;
  req: Request;
}): Promise<{ ok: true; emails: AuthEmail[] }> {
  const { emails } = await resendVerificationWithBetterAuth({
    ctx: authRequestContext(args.req),
    email: args.email,
  });
  return { ok: true as const, emails };
}
