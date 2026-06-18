import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { MemberListQuery } from "./schemas/admin-members";
import { decodeListCursor, encodeListCursor } from "./schemas/shared";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type MemberListRow = {
  id: string;
  status: string;
  invitedEmail: string | null;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

export async function listMembersPaginated(args: {
  tx: Tx;
  tenantId: string;
  query: MemberListQuery;
}): Promise<{
  items: MemberListRow[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;

  const rows = await args.tx.$queryRaw<
    Array<{
      membership_id: string;
      status: string;
      invited_email_normalized: string | null;
      created_at: Date;
      profile_id: string | null;
      display_name: string | null;
      avatar_key: string | null;
    }>
  >`
    select
      m.id::text as membership_id,
      m.status::text as status,
      m.invited_email_normalized,
      m.created_at,
      mp.id::text as profile_id,
      mp.display_name,
      mp.avatar_key
    from memberships m
    left join member_profiles mp
      on mp.tenant_id = m.tenant_id
     and mp.membership_id = m.id
     and mp.deleted_at is null
    where m.tenant_id = ${args.tenantId}::uuid
      and m.status <> 'REMOVED'
      and (${args.query.status ?? null}::text is null or m.status::text = ${args.query.status ?? null})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (m.created_at, m.id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by m.created_at desc, m.id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

  const items = pageRows.map((row) => ({
    id: row.membership_id,
    status: row.status,
    invitedEmail: row.invited_email_normalized,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_key,
        }
      : null,
  }));

  const last = pageRows[pageRows.length - 1];

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeListCursor({
              createdAt: last.created_at,
              id: last.membership_id,
            })
          : null,
    },
  };
}

export async function findMembershipById(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<{
  id: string;
  status: string;
  invitedEmail: string | null;
  joinedAt: Date | null;
  suspendedAt: Date | null;
  removedAt: Date | null;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      invited_email_normalized: string | null;
      joined_at: Date | null;
      suspended_at: Date | null;
      removed_at: Date | null;
    }>
  >`
    select
      id::text,
      status::text,
      invited_email_normalized,
      joined_at,
      suspended_at,
      removed_at
    from memberships
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    invitedEmail: row.invited_email_normalized,
    joinedAt: row.joined_at,
    suspendedAt: row.suspended_at,
    removedAt: row.removed_at,
  };
}

export function memberNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Member not found.",
  });
}

export async function requireMembershipById(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}) {
  const membership = await findMembershipById(args);
  if (!membership || membership.status === "REMOVED") {
    throw memberNotFound();
  }
  return membership;
}

export async function membershipHasRoleKey(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  roleKey: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ exists: boolean }>>`
    select exists (
      select 1
      from user_roles ur
      join roles r
        on r.id = ur.role_id
       and r.tenant_id = ur.tenant_id
       and r.deleted_at is null
      where ur.tenant_id = ${args.tenantId}::uuid
        and ur.membership_id = ${args.membershipId}::uuid
        and r.key = ${args.roleKey}
    ) as exists
  `;

  return Boolean(rows[0]?.exists);
}

export async function listMembershipRoles(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<Array<{ id: string; key: string; name: string; isSystem: boolean }>> {
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; key: string; name: string; is_system: boolean }>
  >`
    select
      r.id::text,
      r.key,
      r.name,
      r.is_system
    from user_roles ur
    join roles r
      on r.id = ur.role_id
     and r.tenant_id = ur.tenant_id
     and r.deleted_at is null
    where ur.tenant_id = ${args.tenantId}::uuid
      and ur.membership_id = ${args.membershipId}::uuid
    order by r.key asc
  `;

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
  }));
}

export async function insertInvitedMembership(args: {
  tx: Tx;
  tenantId: string;
  emailNormalized: string;
  inviteTokenHash: string;
  inviteExpiresAt: Date;
}): Promise<{ id: string }> {
  const id = createUuidV7();

  await args.tx.$queryRaw`
    insert into memberships (
      id,
      tenant_id,
      auth_principal_id,
      status,
      invited_email_normalized,
      invite_token_hash,
      invite_expires_at,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      null,
      'INVITED',
      ${args.emailNormalized},
      ${args.inviteTokenHash},
      ${args.inviteExpiresAt}::timestamptz,
      now(),
      now()
    )
  `;

  return { id };
}

export async function suspendMembershipRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<{ id: string; suspendedAt: Date } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; suspended_at: Date }>>`
    update memberships
    set
      status = 'SUSPENDED',
      suspended_at = now(),
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
      and status in ('ACTIVE', 'INVITED')
    returning id::text, suspended_at
  `;

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, suspendedAt: row.suspended_at };
}

export async function removeMembershipRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<{ id: string; removedAt: Date } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; removed_at: Date }>>`
    update memberships
    set
      status = 'REMOVED',
      removed_at = now(),
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
      and status <> 'REMOVED'
    returning id::text, removed_at
  `;

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, removedAt: row.removed_at };
}

export async function updateMemberProfileRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}): Promise<{
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}> {
  const profileId = createUuidV7();

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      display_name: string | null;
      avatar_key: string | null;
      bio: string | null;
    }>
  >`
    insert into member_profiles (
      id,
      tenant_id,
      membership_id,
      display_name,
      avatar_key,
      bio,
      created_at,
      updated_at
    )
    values (
      ${profileId}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.displayName ?? null},
      ${args.avatarUrl ?? null},
      ${args.bio ?? null},
      now(),
      now()
    )
    on conflict (membership_id)
    do update set
      display_name = coalesce(excluded.display_name, member_profiles.display_name),
      avatar_key = coalesce(excluded.avatar_key, member_profiles.avatar_key),
      bio = coalesce(excluded.bio, member_profiles.bio),
      updated_at = now(),
      deleted_at = null
    returning
      id::text,
      display_name,
      avatar_key,
      bio
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to update member profile");
  }

  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_key,
    bio: row.bio,
  };
}

export async function findMemberProfileRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<{
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      display_name: string | null;
      avatar_key: string | null;
      bio: string | null;
    }>
  >`
    select
      id::text,
      display_name,
      avatar_key,
      bio
    from member_profiles
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_key,
    bio: row.bio,
  };
}
