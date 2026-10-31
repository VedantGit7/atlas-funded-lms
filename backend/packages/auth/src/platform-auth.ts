import type { NextRequest } from "next/server";
// The role catalogue is the only definition of what each platform role may do.
// A hand-copied map here once drifted from it and denied the cost console.
import { resolvePlatformPermissionsForRole } from "@atlas/access/platform-role-permissions";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertPlatformMfa } from "./mfa-enforcement";
import { findActivePlatformOperator } from "./platform-operators.repository";
import { findActiveSessionPrincipal, upsertAuthPrincipal } from "./auth-principal.repository";
import { authProvider, requireBetterAuthUser } from "./better-auth-runtime";
import { requireSupabaseUser } from "./session";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type PlatformPrincipal = {
  platformPrincipalId: string;
  platformPermissions: readonly string[];
};

/** Active database grants are the sole source of platform authority (F02). */
export async function loadPlatformPermissions(
  db: QueryableDb,
  principalId: string,
): Promise<string[]> {
  const grant = await findActivePlatformOperator(db, principalId);
  if (!grant) {
    return [];
  }

  return [...resolvePlatformPermissionsForRole(grant.roleKey)];
}

function hasPlatformPermission(
  grantedPermissions: readonly string[],
  requiredPermission: string,
): boolean {
  return (
    grantedPermissions.includes(requiredPermission) || grantedPermissions.includes("platform.*")
  );
}

export async function requirePlatformPrincipal(args: {
  req: NextRequest;
  db: QueryableDb;
  requiredPermission: string;
  /**
   * The platform MFA enrollment routes only. An operator with no verified
   * factor cannot complete MFA, and enrollment is otherwise a tenant route, so
   * an operator without a tenant could never reach the console. Once a factor
   * is verified, aal2 is required again, so a stolen password cannot add one.
   */
  allowMfaEnrollment?: boolean;
}): Promise<PlatformPrincipal> {
  // The same switch as @atlas/api's resolveSessionPrincipal, kept here so the
  // platform guard has no dependency on the API package.
  const sessionUser =
    authProvider() === "better-auth"
      ? await requireBetterAuthUser(args.req)
      : await requireSupabaseUser(args.req);
  const principal =
    "principalId" in sessionUser
      ? await findActiveSessionPrincipal({ db: args.db, principalId: sessionUser.principalId })
      : await upsertAuthPrincipal({
          db: args.db,
          supabaseUserId: sessionUser.supabaseUserId,
          email: sessionUser.email,
          emailConfirmed: sessionUser.emailConfirmed,
          mfaEnabled: sessionUser.mfaEnabled,
          markLogin: false,
        });

  const platformPermissions = await loadPlatformPermissions(args.db, principal.id);

  if (!hasPlatformPermission(platformPermissions, args.requiredPermission)) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Platform access denied.",
    });
  }

  // H5: enforced only after the permission check, so a caller who is not an
  // operator learns "denied" rather than "you need MFA" — the second answer
  // would confirm that the account is a platform operator to anyone who can
  // reach the endpoint.
  if (!(args.allowMfaEnrollment === true && !sessionUser.mfaEnabled)) {
    assertPlatformMfa({
      sessionAssuranceLevel: sessionUser.sessionAssuranceLevel,
      principalId: principal.id,
    });
  }

  return {
    platformPrincipalId: principal.id,
    platformPermissions,
  };
}
