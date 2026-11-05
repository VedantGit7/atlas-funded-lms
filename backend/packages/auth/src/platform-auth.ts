import type { NextRequest } from "next/server";
// The role catalogue is the only definition of what each platform role may do.
// A hand-copied map here once drifted from it and denied the cost console.
import { resolvePlatformPermissionsForRole } from "@atlas/access/platform-role-permissions";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertPlatformMfa } from "./mfa-enforcement";
import { findActivePlatformOperator } from "./platform-operators.repository";
import { findActiveSessionPrincipal } from "./auth-principal.repository";
import { requireBetterAuthUser } from "./better-auth-runtime";

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
  // As @atlas/api's session seam does, kept here so the platform guard has no
  // dependency on the API package.
  const sessionUser = await requireBetterAuthUser(args.req);
  const principal = await findActiveSessionPrincipal({
    db: args.db,
    principalId: sessionUser.principalId,
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
