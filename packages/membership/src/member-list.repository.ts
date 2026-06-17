type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type MemberListItem = {
  id: string;
  status: string;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

export async function listMembersForTenant(args: {
  tx: Tx;
  tenantId: string;
  limit?: number;
}): Promise<MemberListItem[]> {
  const limit = Math.min(args.limit ?? 25, 100);

  const rows = await args.tx.$queryRaw<
    Array<{
      membership_id: string;
      status: string;
      profile_id: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>
  >`
      select
        m.id::text as membership_id,
        m.status::text as status,
        mp.id::text as profile_id,
        mp.display_name,
        mp.avatar_url
      from memberships m
      left join member_profiles mp
        on mp.tenant_id = m.tenant_id
       and mp.membership_id = m.id
       and mp.deleted_at is null
      where m.tenant_id = ${args.tenantId}::uuid
        and m.status <> 'REMOVED'
      order by m.created_at desc
      limit ${limit}
    `;

  return rows.map((row) => ({
    id: row.membership_id,
    status: row.status,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        }
      : null,
  }));
}
