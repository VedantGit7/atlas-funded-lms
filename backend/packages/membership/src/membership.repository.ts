import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { invalidInvitation } from "./membership-errors";
import type { MembershipProjection } from "./types";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  auth_principal_id: string | null;
  status: MembershipProjection["status"];
  invited_email_normalized: string | null;
};

function mapMembershipRow(row: MembershipRow): MembershipProjection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authPrincipalId: row.auth_principal_id,
    status: row.status,
    invitedEmailNormalized: row.invited_email_normalized,
  };
}

export async function findMembershipByPrincipal(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
}): Promise<MembershipProjection | null> {
  const rows = await args.tx.$queryRaw<MembershipRow[]>`
    select
      id::text,
      tenant_id::text,
      auth_principal_id::text,
      status::text,
      invited_email_normalized::text
    from memberships
    where tenant_id = ${args.tenantId}::uuid
      and auth_principal_id = ${args.authPrincipalId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapMembershipRow(row);
}

/**
 * The membership gate's whole database work in one round trip (audit §3.1):
 * the membership, its principal's account status (audit H6), and the activity
 * bookkeeping. This runs on every authenticated tenant request.
 *
 * Activity is recorded only for an ACTIVE membership of an active account: the
 * throttled `last_active_at` touch, and the per-day row behind MAU/DAU (a no-op
 * after the day's first request thanks to its primary key). A refused request
 * writes nothing. The returned row is the state before those writes.
 *
 * `principalStatus` is null when the principal row no longer exists.
 */
export async function findMembershipForRequest(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
  lastActiveThrottleMinutes: number;
}): Promise<{ membership: MembershipProjection; principalStatus: string | null } | null> {
  const rows = await args.tx.$queryRaw<Array<MembershipRow & { principal_status: string | null }>>`
    with found as (
      select m.id, m.tenant_id, m.auth_principal_id, m.status, m.invited_email_normalized,
             ap.global_status as principal_status
      from memberships m
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = ${args.tenantId}::uuid
        and m.auth_principal_id = ${args.authPrincipalId}::uuid
      limit 1
    ),
    admitted as (
      select id, tenant_id from found
      where status = 'ACTIVE' and principal_status = 'active'
    ),
    touched as (
      update memberships m
      set last_active_at = now()
      from admitted
      where m.tenant_id = admitted.tenant_id
        and m.id = admitted.id
        and (
          m.last_active_at is null
          or m.last_active_at < now() - make_interval(mins => ${args.lastActiveThrottleMinutes})
        )
      returning m.id
    ),
    active_day as (
      insert into tenant_active_days (tenant_id, membership_id, day)
      select tenant_id, id, current_date from admitted
      on conflict (tenant_id, membership_id, day) do nothing
      returning membership_id
    )
    select
      id::text,
      tenant_id::text,
      auth_principal_id::text,
      status::text,
      invited_email_normalized::text,
      principal_status
    from found
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return { membership: mapMembershipRow(row), principalStatus: row.principal_status };
}

/**
 * Inserts a brand-new ACTIVE membership for an open self-service signup.
 *
 * Uses `on conflict do nothing` so it never overrides an existing membership in
 * any state. This is important: a SUSPENDED or REMOVED membership must NOT be
 * silently reactivated, and an INVITED membership must keep flowing through the
 * invitation acceptance path. Returns null when a membership already existed.
 */
export async function insertActiveSelfServiceMembership(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
  email: string;
}): Promise<{ id: string } | null> {
  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<{ id: string }[]>`
    insert into memberships (
      id,
      tenant_id,
      auth_principal_id,
      status,
      invited_email_normalized,
      joined_at,
      accepted_at,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.authPrincipalId}::uuid,
      'ACTIVE',
      ${args.email.trim().toLowerCase()},
      now(),
      now(),
      now(),
      now()
    )
    on conflict (tenant_id, auth_principal_id) do nothing
    returning id::text
  `;

  return rows[0] ?? null;
}

export async function findInvitedMembershipByTokenHash(args: {
  tx: Tx;
  tenantId: string;
  tokenHash: string;
}): Promise<MembershipProjection | null> {
  const rows = await args.tx.$queryRaw<MembershipRow[]>`
    select
      id::text,
      tenant_id::text,
      auth_principal_id::text,
      status::text,
      invited_email_normalized::text
    from memberships
    where tenant_id = ${args.tenantId}::uuid
      and status = 'INVITED'
      and invite_token_hash = ${args.tokenHash}
      and invite_expires_at > now()
      and accepted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapMembershipRow(row);
}

export async function activateInvitedMembership(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  authPrincipalId: string;
}): Promise<MembershipProjection> {
  const rows = await args.tx.$queryRaw<MembershipRow[]>`
    update memberships
    set
      auth_principal_id = ${args.authPrincipalId}::uuid,
      status = 'ACTIVE',
      joined_at = now(),
      accepted_at = now(),
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
      and status = 'INVITED'
      and accepted_at is null
      and invite_expires_at > now()
    returning
      id::text,
      tenant_id::text,
      auth_principal_id::text,
      status::text,
      invited_email_normalized::text
  `;

  const row = rows[0];

  if (!row) {
    throw invalidInvitation();
  }

  return mapMembershipRow(row);
}
