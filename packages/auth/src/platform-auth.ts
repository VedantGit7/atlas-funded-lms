import type { NextRequest } from "next/server";
import {
  parsePlatformOperatorAssignments,
  resolvePlatformPermissionsForRole,
  type PlatformRoleKey,
} from "./platform-role-resolution";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { upsertAuthPrincipal } from "./auth-principal.repository";
import { requireSupabaseUser } from "./session";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type PlatformPrincipal = {
  platformPrincipalId: string;
  platformPermissions: readonly string[];
};

async function resolvePlatformRoleForPrincipal(
  db: QueryableDb,
  principalId: string,
): Promise<PlatformRoleKey | null> {
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

  const assignments = parsePlatformOperatorAssignments(
    process.env["PLATFORM_OPERATOR_ASSIGNMENTS"] ?? "",
  );
  return assignments.get(email) ?? null;
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

  return {
    platformPrincipalId: principal.id,
    platformPermissions,
  };
}
