import {
  requireSupabaseUser,
  upsertAuthPrincipal,
  type AuthPrincipalBridge,
  type SessionUser,
} from "@atlas/auth";
// Subpaths, so tests that replace the whole package keep the Supabase default.
import { findActiveSessionPrincipal } from "@atlas/auth/auth-principal.repository";
import { authProvider, requireBetterAuthUser } from "@atlas/auth/better-auth-runtime";

type QueryableDb = Parameters<typeof upsertAuthPrincipal>[0]["db"];

/**
 * The signed-in user, from whichever login system this deployment uses
 * (`AUTH_PROVIDER`, launch plan phase 3; docs/engineering/better-auth-design.md).
 */
export async function requireSessionUser(req: Request): Promise<SessionUser> {
  if (authProvider() === "better-auth") {
    return { provider: "better-auth", ...(await requireBetterAuthUser(req)) };
  }
  return { provider: "supabase", ...(await requireSupabaseUser(req)) };
}

/**
 * The principal behind a signed-in user. A Supabase user is mirrored into its
 * principal as before (audit H6); a Better Auth user is the principal.
 */
export async function resolveSessionPrincipal(args: {
  db: QueryableDb;
  user: SessionUser;
  markLogin?: boolean;
}): Promise<AuthPrincipalBridge> {
  if (args.user.provider === "better-auth") {
    return findActiveSessionPrincipal({ db: args.db, principalId: args.user.principalId });
  }
  return upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: args.user.supabaseUserId,
    email: args.user.email,
    emailConfirmed: args.user.emailConfirmed,
    mfaEnabled: args.user.mfaEnabled,
    markLogin: args.markLogin ?? false,
  });
}
