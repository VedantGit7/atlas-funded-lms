import type { TenantTx } from "@atlas/db";

type Tx = Pick<TenantTx, "$queryRaw">;

export type SelfArchiveStatus = { archivedAt: string | null };

/**
 * Self-initiated archive: distinct from admin-initiated suspension. The member
 * stops appearing in active-member counts and can't be enrolled in new things,
 * but all data (progress, certificates, enrollments) stays intact. Reversible
 * by the member themselves via unarchiveOwnMembership.
 */
export async function archiveOwnMembership(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<SelfArchiveStatus> {
  const rows = await args.tx.$queryRaw<Array<{ archived_at: Date | null }>>`
    update memberships
    set archived_at = now(), updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
    returning archived_at
  `;

  const row = rows[0];
  return { archivedAt: row?.archived_at?.toISOString() ?? null };
}

export async function unarchiveOwnMembership(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<SelfArchiveStatus> {
  const rows = await args.tx.$queryRaw<Array<{ archived_at: Date | null }>>`
    update memberships
    set archived_at = null, updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
    returning archived_at
  `;

  const row = rows[0];
  return { archivedAt: row?.archived_at?.toISOString() ?? null };
}

export async function findOwnArchiveStatus(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<SelfArchiveStatus> {
  const rows = await args.tx.$queryRaw<Array<{ archived_at: Date | null }>>`
    select archived_at
    from memberships
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
    limit 1
  `;

  const row = rows[0];
  return { archivedAt: row?.archived_at?.toISOString() ?? null };
}
