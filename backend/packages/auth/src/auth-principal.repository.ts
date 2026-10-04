import { createUuidV7 } from "@atlas/core/id/uuid-v7";

import { accountDisabled, accountReviewRequired, emailNotVerified } from "./auth-errors";
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

type EmailOwnerRow = {
  id: string;

  supabase_user_id: string;

  global_status: string;
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
 * Resolves the principal for a verified Supabase user (audit H6).
 *
 * A principal is bound to one Supabase user. The email alone never moves it:
 *
 * - matched by Supabase id: refresh email and MFA state, refuse if disabled;
 * - an unclaimed placeholder with this email (created by the integration
 *   sign-up API before its owner signed up): the first sign-in with a
 *   *confirmed* email claims it, unless it carries a platform grant;
 * - no principal with this email: create one, again only for a confirmed email;
 * - an active principal with this email but another Supabase user (a deleted
 *   account re-registered, or someone who controls the address now): refuse,
 *   and record a relink request for a platform operator to review.
 *
 * Every statement is atomic on its own, so this is correct both inside one
 * transaction and on a per-statement connection. The sign-in routes use the
 * latter, which is also what keeps the relink request when the sign-in is
 * refused; inside a transaction it rolls back with the refusal.
 */
export async function upsertAuthPrincipal(args: {
  db: QueryableDb;

  supabaseUserId: string;

  email: string;

  /**
   * Supabase `email_confirmed_at` is set. Required, so no caller can forget it:
   * nothing is created or claimed for an unconfirmed address.
   */
  emailConfirmed: boolean;

  mfaEnabled?: boolean;

  markLogin?: boolean;
}): Promise<AuthPrincipalBridge> {
  const emailNormalized = args.email.trim().toLowerCase();

  const mfaEnabled = args.mfaEnabled ?? false;

  const markLogin = args.markLogin ?? false;

  const emailConfirmed = args.emailConfirmed;

  // Two passes cover the one race that matters: two first requests for the same
  // new user, where the loser's insert conflicts and its retry finds the
  // winner's row by Supabase id.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const bound = await findBoundPrincipal(args.db, {
      supabaseUserId: args.supabaseUserId,
      email: args.email,
      emailNormalized,
      mfaEnabled,
      markLogin,
    });

    if (bound) {
      if (bound.global_status !== "active") {
        throw accountDisabled();
      }
      return mapPrincipalRow(bound);
    }

    if (!emailConfirmed) {
      // Nothing is created or claimed for an address nobody has proven they own.
      throw emailNotVerified();
    }

    const claimed = await claimUnclaimedPrincipal(args.db, {
      supabaseUserId: args.supabaseUserId,
      email: args.email,
      emailNormalized,
      mfaEnabled,
      markLogin,
    });

    if (claimed) {
      return mapPrincipalRow(claimed);
    }

    const inserted = await insertPrincipal(args.db, {
      supabaseUserId: args.supabaseUserId,
      email: args.email,
      emailNormalized,
      mfaEnabled,
      markLogin,
    });

    if (inserted) {
      return mapPrincipalRow(inserted);
    }

    const owners = await args.db.$queryRaw<EmailOwnerRow[]>`

      select id::text, supabase_user_id::text, global_status

      from auth_principals

      where email_normalized = ${emailNormalized}

      limit 1

    `;

    const owner = owners[0];

    if (owner && owner.supabase_user_id !== args.supabaseUserId) {
      await recordRelinkRequest(args.db, {
        principalId: owner.id,
        requestedSupabaseUserId: args.supabaseUserId,
      });

      throw accountReviewRequired();
    }
  }

  throw new Error("Failed to resolve auth principal");
}

async function findBoundPrincipal(
  db: QueryableDb,
  args: {
    supabaseUserId: string;
    email: string;
    emailNormalized: string;
    mfaEnabled: boolean;
    markLogin: boolean;
  },
): Promise<PrincipalRow | null> {
  // Writes only when something changed: this runs on every authenticated
  // request, and an unconditional UPDATE rewrote the row each time.
  const rows = await db.$queryRaw<PrincipalRow[]>`

    with bound as (

      select id, global_status

      from auth_principals

      where supabase_user_id = ${args.supabaseUserId}::uuid

    ),

    touched as (

      update auth_principals as ap

      set

        email = ${args.email},

        email_normalized = ${args.emailNormalized},

        mfa_enabled = ${args.mfaEnabled},

        last_login_at = case when ${args.markLogin} then now() else ap.last_login_at end,

        updated_at = now()

      from bound

      where ap.id = bound.id

        and bound.global_status = 'active'

        and (

          ${args.markLogin}

          or ap.email is distinct from ${args.email}

          or ap.email_normalized is distinct from ${args.emailNormalized}

          or ap.mfa_enabled is distinct from ${args.mfaEnabled}

        )

      returning ap.id, ap.email, ap.email_normalized, ap.global_status, ap.mfa_enabled, ap.last_login_at

    )

    select id::text, email, email_normalized, global_status, mfa_enabled, last_login_at

    from touched

    union all

    select ap.id::text, ap.email, ap.email_normalized, ap.global_status, ap.mfa_enabled, ap.last_login_at

    from auth_principals as ap

    join bound on bound.id = ap.id

    where not exists (select 1 from touched)

  `;

  return rows[0] ?? null;
}

async function claimUnclaimedPrincipal(
  db: QueryableDb,
  args: {
    supabaseUserId: string;
    email: string;
    emailNormalized: string;
    mfaEnabled: boolean;
    markLogin: boolean;
  },
): Promise<PrincipalRow | null> {
  // Platform grants are never transferred by a sign-in, claimed or not.
  const rows = await db.$queryRaw<PrincipalRow[]>`

    update auth_principals as ap

    set

      supabase_user_id = ${args.supabaseUserId}::uuid,

      email = ${args.email},

      global_status = 'active',

      mfa_enabled = ${args.mfaEnabled},

      last_login_at = case when ${args.markLogin} then now() else ap.last_login_at end,

      updated_at = now()

    where ap.email_normalized = ${args.emailNormalized}

      and ap.global_status = 'unclaimed'

      and not exists (

        select 1

        from platform_operators as po

        where po.auth_principal_id = ap.id

          and po.revoked_at is null

      )

    returning

      ap.id::text,

      ap.email,

      ap.email_normalized,

      ap.global_status,

      ap.mfa_enabled,

      ap.last_login_at

  `;

  return rows[0] ?? null;
}

async function insertPrincipal(
  db: QueryableDb,
  args: {
    supabaseUserId: string;
    email: string;
    emailNormalized: string;
    mfaEnabled: boolean;
    markLogin: boolean;
  },
): Promise<PrincipalRow | null> {
  const rows = await db.$queryRaw<PrincipalRow[]>`

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

      ${createUuidV7()}::uuid,

      ${args.supabaseUserId}::uuid,

      ${args.email},

      ${args.emailNormalized},

      'active',

      ${args.mfaEnabled},

      case when ${args.markLogin} then now() else null end,

      now(),

      now()

    )

    on conflict do nothing

    returning

      id::text,

      email,

      email_normalized,

      global_status,

      mfa_enabled,

      last_login_at

  `;

  return rows[0] ?? null;
}

async function recordRelinkRequest(
  db: QueryableDb,
  args: { principalId: string; requestedSupabaseUserId: string },
): Promise<void> {
  // One pending row per (principal, new Supabase user); repeats only count.
  await db.$queryRaw`

    insert into auth_principal_relink_requests (

      auth_principal_id,

      previous_supabase_user_id,

      requested_supabase_user_id,

      email_normalized

    )

    select ap.id, ap.supabase_user_id, ${args.requestedSupabaseUserId}::uuid, ap.email_normalized

    from auth_principals as ap

    where ap.id = ${args.principalId}::uuid

    on conflict (auth_principal_id, requested_supabase_user_id) where status = 'pending'

    do update set

      last_seen_at = now(),

      attempt_count = auth_principal_relink_requests.attempt_count + 1

  `;
}
