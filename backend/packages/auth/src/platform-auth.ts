import type { NextRequest } from "next/server";
import { resolvePlatformPermissionsForRole } from "./platform-role-resolution";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertPlatformMfa } from "./mfa-enforcement";
import { findActivePlatformOperator } from "./platform-operators.repository";
import { upsertAuthPrincipal } from "./auth-principal.repository";
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
}): Promise<PlatformPrincipal> {
  const supabaseUser = await requireSupabaseUser(args.req);
  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: supabaseUser.supabaseUserId,
    email: supabaseUser.email,
    emailConfirmed: supabaseUser.emailConfirmed,
    mfaEnabled: supabaseUser.mfaEnabled,
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
  assertPlatformMfa({
    sessionAssuranceLevel: supabaseUser.sessionAssuranceLevel,
    principalId: principal.id,
  });

  return {
    platformPrincipalId: principal.id,
    platformPermissions,
  };
}
