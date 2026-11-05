import { accountDisabled, authRequired } from "./auth-errors";
import type { AuthPrincipalBridge } from "./types";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type PrincipalRow = {
  id: string;
  email: string;
  email_normalized: string;
  global_status: string;
  mfa_enabled: boolean;
  last_login_at: Date | null;
};

function mapPrincipalRow(row: PrincipalRow): AuthPrincipalBridge {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.email_normalized,
    globalStatus: row.global_status,
    mfaEnabled: row.mfa_enabled,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * The principal behind a session. A Better Auth user is the principal itself,
 * so nothing is mirrored: it is read, and refused unless active, so disabling
 * an account takes effect on the next request.
 */
export async function findActiveSessionPrincipal(args: {
  db: QueryableDb;
  principalId: string;
}): Promise<AuthPrincipalBridge> {
  const rows = await args.db.$queryRaw<PrincipalRow[]>`
    select id::text, email, email_normalized, global_status, mfa_enabled, last_login_at
    from auth_principals
    where id = ${args.principalId}::uuid
  `;
  const principal = rows[0];
  if (!principal) throw authRequired();
  if (principal.global_status !== "active") throw accountDisabled();
  return mapPrincipalRow(principal);
}
