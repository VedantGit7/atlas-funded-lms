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
