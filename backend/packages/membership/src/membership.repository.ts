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
 * The principal's account status, read by the membership gate (audit H6).
 * Principal resolution already refuses a disabled principal at sign-in and on
 * every request; reading it again here keeps tenant access closed even for a
 * caller that reached the gate some other way. Null when no principal exists.
 */
export async function findPrincipalGlobalStatus(args: {
  tx: Tx;
  authPrincipalId: string;
}): Promise<string | null> {
  const rows = await args.tx.$queryRaw<{ global_status: string }[]>`
    select global_status
    from auth_principals
    where id = ${args.authPrincipalId}::uuid
  `;

  return rows[0]?.global_status ?? null;
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

/**
 * Records that a member was active "now", throttled so the row is only written
 * at most once per `throttleMinutes`. Runs inside the request's tenant
 * transaction; the WHERE clause keeps it a no-op write on most requests.
 */
export async function touchMembershipLastActive(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  throttleMinutes: number;
}): Promise<void> {
  await args.tx.$queryRaw`
    update memberships
    set last_active_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
      and status = 'ACTIVE'
      and (
        last_active_at is null
        or last_active_at < now() - make_interval(mins => ${args.throttleMinutes})
      )
    returning id
  `;
}

/**
 * Records that a membership was active today (idempotent per tenant/member/day).
 * Feeds the Usage Insights MAU/DAU metrics; a no-op after the first hit of the
 * day thanks to the composite primary key.
 */
export async function recordMembershipActiveDay(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<void> {
  await args.tx.$queryRaw`
    insert into tenant_active_days (tenant_id, membership_id, day)
    values (${args.tenantId}::uuid, ${args.membershipId}::uuid, current_date)
    on conflict (tenant_id, membership_id, day) do nothing
  `;
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
