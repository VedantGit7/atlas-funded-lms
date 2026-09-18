import { createUuidV7 } from "@atlas/core/id/uuid-v7";

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

  // Re-link an existing principal when the email already exists but Supabase

  // issued a new user id (re-signup after account deletion, prior failed signup,

  // or seeded membership data). Prefer supabase_user_id matches over email-only.

  const updatedRows = await args.db.$queryRaw<PrincipalRow[]>`

    update auth_principals as ap

    set

      supabase_user_id = ${args.supabaseUserId}::uuid,

      email = ${args.email},

      email_normalized = ${emailNormalized},

      mfa_enabled = ${mfaEnabled},

      last_login_at = case when ${markLogin} then now() else ap.last_login_at end,

      updated_at = now()

    where ap.id = (

      select candidate.id

      from auth_principals as candidate

      where candidate.supabase_user_id = ${args.supabaseUserId}::uuid

         or candidate.email_normalized = ${emailNormalized}

      order by case when candidate.supabase_user_id = ${args.supabaseUserId}::uuid then 0 else 1 end

      limit 1

    )

    returning

      ap.id::text,

      ap.email,

      ap.email_normalized,

      ap.global_status,

      ap.mfa_enabled,

      ap.last_login_at

  `;

  if (updatedRows[0]) {
    return mapPrincipalRow(updatedRows[0]);
  }

  const insertedRows = await args.db.$queryRaw<PrincipalRow[]>`

    insert into auth_principals (

      id,

      supabase_user_id,

      email,

      email_normalized,

      global_status,

      mfa_enabled,

      last_login_at,

      created_at,

      updated_at

    )

    values (

      ${id}::uuid,

      ${args.supabaseUserId}::uuid,

      ${args.email},

      ${emailNormalized},

      'active',

      ${mfaEnabled},

      case when ${markLogin} then now() else null end,

      now(),

      now()

    )

    on conflict (email_normalized)

    do update set

      supabase_user_id = excluded.supabase_user_id,

      email = excluded.email,

      mfa_enabled = excluded.mfa_enabled,

      last_login_at = case

        when excluded.last_login_at is not null then excluded.last_login_at

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

  const row = insertedRows[0];

  if (!row) {
    throw new Error("Failed to upsert auth principal");
  }

  return mapPrincipalRow(row);
}
