import type { AuthPrincipalBridge, SessionUser } from "@atlas/auth";
// Subpaths, so tests that replace the whole package keep these.
import { findActiveSessionPrincipal } from "@atlas/auth/auth-principal.repository";
import { requireBetterAuthUser } from "@atlas/auth/better-auth-runtime";

type QueryableDb = Parameters<typeof findActiveSessionPrincipal>[0]["db"];

/** The signed-in user, from the Better Auth session (docs/engineering/better-auth-design.md). */
export async function requireSessionUser(req: Request): Promise<SessionUser> {
  return requireBetterAuthUser(req);
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
