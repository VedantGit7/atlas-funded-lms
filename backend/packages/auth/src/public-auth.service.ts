import type { PublicLoginInput, PublicSignupCompleteInput, PublicSignupInput } from "./schemas";
import { invalidCredentials } from "./auth-errors";
import { findActiveSessionPrincipal } from "./auth-principal.repository";
import {
  authRequestContext,
  completeSignUp,
  requestSignUpLink,
  signInWithBetterAuth,
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
 * Starts a sign-up: emails the link that finishes it (security review 5.3,
 * finding 1). Nothing is created until the link is opened and a password
 * chosen, so a principal only exists for an address its owner has proven
 * (audit H6). The route sends the email; the answer is the same for every
 * address.
 */
export async function requestSignup(args: {
  input: PublicSignupInput;
}): Promise<{ status: "verification_required"; emails: AuthEmail[] }> {
  const result = await requestSignUpLink({
    email: args.input.email,
    displayName: args.input.displayName?.trim(),
    inviteToken: args.input.inviteToken,
    // The schema only admits a sign-up whose "I agree" box was ticked.
    termsAcceptedAt: new Date().toISOString(),
  });
  return { status: "verification_required" as const, emails: result.emails };
}

/**
 * Finishes a sign-up from its emailed link: checks the password against
 * breaches before the single-use link is spent, then creates the verified
 * account and signs it in.
 */
export async function completeSignup(args: {
  db: QueryableDb;
  input: PublicSignupCompleteInput;
  req: Request;
}) {
  await assertPasswordNotBreached(args.input.password);
  const completed = await completeSignUp({
    ctx: authRequestContext(args.req),
    token: args.input.token,
    password: args.input.password,
  });
  const principal = await findActiveSessionPrincipal({
    db: args.db,
    principalId: completed.principalId,
  });
  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    session: completed.cookies,
    ...(completed.inviteToken ? { inviteToken: completed.inviteToken } : {}),
    ...(completed.termsAcceptedAt ? { termsAcceptedAt: completed.termsAcceptedAt } : {}),
  };
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
 * Re-sends the link that finishes a sign-up: a fresh one, since only its hash
 * is stored. Anti-enumeration: the outcome is uniform whether or not the
 * address exists or is already verified, so the response can't be used to
 * probe accounts.
 */
export async function resendSignupVerification(args: {
  email: string;
}): Promise<{ ok: true; emails: AuthEmail[] }> {
  const { emails } = await requestSignUpLink({ email: args.email });
  return { ok: true as const, emails };
}
