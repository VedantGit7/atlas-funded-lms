import type { NextRequest } from "next/server";
import {
  parsePlatformOperatorAssignments,
  resolvePlatformPermissionsForRole,
  type PlatformRoleKey,
} from "./platform-role-resolution";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { structuredLogger } from "@atlas/observability/logger";
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

/**
 * Resolve the platform role for a principal. Audit finding H7.
 *
 * Database first. Grants are rows in `platform_operators`, so they carry who
 * granted them, when, why, and their revocation history — and they can be
 * revoked without a deploy.
 *
 * `PLATFORM_OPERATOR_ASSIGNMENTS` remains only as break-glass: bootstrapping the
 * first operator on a fresh environment, and recovering when every grant has
 * been revoked by mistake. It is deliberately checked *after* the table, so a
 * database revocation cannot be silently overridden by stale deploy config, and
 * every use is logged loudly because an env-var grant is exactly the
 * unattributable escalation this finding was about.
 */
async function resolvePlatformRoleForPrincipal(
  db: QueryableDb,
  principalId: string,
): Promise<PlatformRoleKey | null> {
  const grant = await findActivePlatformOperator(db, principalId);
  if (grant) {
    return grant.roleKey;
  }

  const raw = process.env["PLATFORM_OPERATOR_ASSIGNMENTS"] ?? "";
  if (!raw.trim()) {
    return null;
  }

  const rows = await db.$queryRaw<{ email_normalized: string }[]>`
    SELECT email_normalized
    FROM auth_principals
    WHERE id = ${principalId}::uuid
    LIMIT 1
  `;
  const email = rows[0]?.email_normalized;
  if (!email) {
    return null;
  }

  const assignments = parsePlatformOperatorAssignments(raw);
  const role = assignments.get(email) ?? null;

  if (role) {
    structuredLogger.warn({
      message: "platform.operator.break_glass_env_grant",
      module: "platform-auth",
      eventType: "platform.operator.break_glass",
      actorSafeId: principalId,
      role,
      detail:
        "Platform access granted from PLATFORM_OPERATOR_ASSIGNMENTS, not from platform_operators. " +
        "This grant is unattributable and survives database revocation. Move it into the table.",
    });
  }

  return role;
}

export async function loadPlatformPermissions(
  db: QueryableDb,
  principalId: string,
): Promise<string[]> {
  const role = await resolvePlatformRoleForPrincipal(db, principalId);
  if (!role) {
    return [];
  }

  return [...resolvePlatformPermissionsForRole(role)];
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
  assertPlatformMfa({ mfaEnabled: supabaseUser.mfaEnabled, principalId: principal.id });

  return {
    platformPrincipalId: principal.id,
    platformPermissions,
  };
}
