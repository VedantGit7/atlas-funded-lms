import type { NextRequest } from "next/server";
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

export function loadPlatformPermissions(db: QueryableDb, principalId: string): string[] {
  void db;
  void principalId;
  return [];
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

  const platformPermissions = loadPlatformPermissions(args.db, principal.id);

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
