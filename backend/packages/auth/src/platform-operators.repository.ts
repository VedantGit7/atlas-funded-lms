import type { PlatformRoleKey } from "./platform-role-resolution";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type PlatformOperatorGrant = {
  id: string;
  authPrincipalId: string;
  roleKey: PlatformRoleKey;
  grantedAt: Date;
  grantedByPrincipalId: string | null;
  grantReason: string | null;
};

/**
 * Read the active platform grant for a principal. Audit finding H7.
 *
 * Returns null when the principal holds no grant, which the caller treats as
 * "not a platform operator". Revoked rows are excluded by the `revoked_at IS
 * NULL` predicate rather than deleted, so the history stays queryable — "who
 * had cross-tenant access in March" is the question an auditor asks, and it is
 * unanswerable if revocation destroys the row.
 */
export async function findActivePlatformOperator(
  db: QueryableDb,
  authPrincipalId: string,
): Promise<PlatformOperatorGrant | null> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      auth_principal_id: string;
      role_key: string;
      granted_at: Date;
      granted_by_principal_id: string | null;
      grant_reason: string | null;
    }>
  >`
    SELECT id::text,
           auth_principal_id::text,
           role_key,
           granted_at,
           granted_by_principal_id::text,
           grant_reason
      FROM platform_operators
     WHERE auth_principal_id = ${authPrincipalId}::uuid
       AND revoked_at IS NULL
     LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    authPrincipalId: row.auth_principal_id,
    // The CHECK constraint on the table restricts this to the three role keys.
    roleKey: row.role_key as PlatformRoleKey,
    grantedAt: row.granted_at,
    grantedByPrincipalId: row.granted_by_principal_id,
    grantReason: row.grant_reason,
  };
}

/** Every grant for a principal, active and revoked, newest first. */
export async function listPlatformOperatorHistory(
  db: QueryableDb,
  authPrincipalId: string,
): Promise<
  Array<{
    id: string;
    roleKey: string;
    grantedAt: Date;
    revokedAt: Date | null;
    grantReason: string | null;
    revokeReason: string | null;
  }>
> {
  return db.$queryRaw`
    SELECT id::text,
           role_key      AS "roleKey",
           granted_at    AS "grantedAt",
           revoked_at    AS "revokedAt",
           grant_reason  AS "grantReason",
           revoke_reason AS "revokeReason"
      FROM platform_operators
     WHERE auth_principal_id = ${authPrincipalId}::uuid
     ORDER BY granted_at DESC
  `;
}
