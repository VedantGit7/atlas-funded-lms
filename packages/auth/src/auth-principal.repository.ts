import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { AuthPrincipalBridge } from "./types";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function upsertAuthPrincipal(args: {
  db: QueryableDb;
  supabaseUserId: string;
  email: string;
  mfaEnabled?: boolean;
  markLogin?: boolean;
}): Promise<AuthPrincipalBridge> {
  const emailNormalized = args.email.trim().toLowerCase();
  const id = createUuidV7();
  const mfaEnabled = args.mfaEnabled ?? false;
  const markLogin = args.markLogin ?? false;

  const rows = await args.db.$queryRaw<
    Array<{
      id: string;
      email: string;
      email_normalized: string;
      global_status: string;
      mfa_enabled: boolean;
      last_login_at: Date | null;
    }>
  >`
    insert into auth_principals (
      id,
      supabase_user_id,
      email,
      email_normalized,
      global_status,
      mfa_enabled,
      last_login_at
    )
    values (
      ${id}::uuid,
      ${args.supabaseUserId}::uuid,
      ${args.email},
      ${emailNormalized},
      'active',
      ${mfaEnabled},
      case when ${markLogin} then now() else null end
    )
    on conflict (supabase_user_id)
    do update set
      email = excluded.email,
      email_normalized = excluded.email_normalized,
      mfa_enabled = excluded.mfa_enabled,
      last_login_at = case
        when ${markLogin} then now()
        else auth_principals.last_login_at
      end,
      updated_at = now()
    returning
      id::text,
      email,
      email_normalized,
      global_status,
      mfa_enabled,
      last_login_at
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to upsert auth principal");
  }

  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.email_normalized,
    globalStatus: row.global_status,
    mfaEnabled: row.mfa_enabled,
    lastLoginAt: row.last_login_at,
  };
}
