import type { AuthPrincipalBridge, SessionUser } from "@atlas/auth";
// Subpaths, so tests that replace the whole package keep these.
import { findActiveSessionPrincipal } from "@atlas/auth/auth-principal.repository";
import { requireBetterAuthUser } from "@atlas/auth/better-auth-runtime";
import { assertSecondFactorComplete } from "@atlas/auth/mfa-enforcement";

type QueryableDb = Parameters<typeof findActiveSessionPrincipal>[0]["db"];

/**
 * The signed-in user, from the Better Auth session
 * (docs/engineering/better-auth-design.md). An account with an authenticator
 * counts as signed in only once this session has passed it (security review
 * 5.3, finding 2); only the route that takes the code accepts it before.
 */
export async function requireSessionUser(
  req: Request,
  options: { allowPendingSecondFactor?: boolean } = {},
): Promise<SessionUser> {
  const user = await requireBetterAuthUser(req);
  if (!options.allowPendingSecondFactor) assertSecondFactorComplete(user);
  return user;
}

/**
 * The principal behind a signed-in user: the Better Auth user is the
 * principal, read and refused unless active.
 */
export async function resolveSessionPrincipal(args: {
  db: QueryableDb;
  user: SessionUser;
}): Promise<AuthPrincipalBridge> {
  return findActiveSessionPrincipal({ db: args.db, principalId: args.user.principalId });
}
