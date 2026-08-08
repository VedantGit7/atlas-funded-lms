import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { MemberListQuery } from "./schemas/admin-members";
import { decodeListCursor, encodeListCursor } from "./schemas/shared";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type MemberListRoleRow = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

export type MemberListRow = {
  id: string;
  status: string;
  invitedEmail: string | null;
  accountEmail: string | null;
  joinedAt: Date | null;
  lastActiveAt: Date | null;
  archivedAt: Date | null;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  roles: MemberListRoleRow[];
};

export async function listMembersPaginated(args: {
  tx: Tx;
  tenantId: string;
  query: MemberListQuery;
}): Promise<{
  items: MemberListRow[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  totalCount: number;
}> {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;
  const search = args.query.search ?? null;
  const searchLike = search ? `%${search}%` : null;
  const role = args.query.role ?? null;

  const rows = await args.tx.$queryRaw<
    Array<{
      membership_id: string;
      status: string;
      invited_email_normalized: string | null;
      account_email: string | null;
      joined_at: Date | null;
      last_active_at: Date | null;
      archived_at: Date | null;
      created_at: Date;
      profile_id: string | null;
      display_name: string | null;
      avatar_key: string | null;
      roles_json: MemberListRoleRow[] | null;
    }>
  >`
    select
      m.id::text as membership_id,
      m.status::text as status,
      m.invited_email_normalized,
      ap.email as account_email,
      m.joined_at,
      m.last_active_at,
      m.archived_at,
      m.created_at,
      mp.id::text as profile_id,
      mp.display_name,
      mp.avatar_key,
      coalesce(
        (
          select json_agg(
            json_build_object(
              'id', r.id::text,
              'key', r.key,
              'name', r.name,
              'isSystem', r.is_system
            )
            order by r.key
          )
          from user_roles ur
          join roles r
            on r.id = ur.role_id
           and r.tenant_id = ur.tenant_id
           and r.deleted_at is null
          where ur.tenant_id = m.tenant_id
            and ur.membership_id = m.id
        ),
        '[]'::json
      ) as roles_json
    from memberships m
    left join member_profiles mp
      on mp.tenant_id = m.tenant_id
     and mp.membership_id = m.id
     and mp.deleted_at is null
    left join auth_principals ap
      on ap.id = m.auth_principal_id
    where m.tenant_id = ${args.tenantId}::uuid
      and m.status <> 'REMOVED'
      and (${args.query.status ?? null}::text is null or m.status::text = ${args.query.status ?? null})
      and (
        ${searchLike}::text is null
        or mp.display_name ilike ${searchLike}
        or m.invited_email_normalized ilike ${searchLike}
        or ap.email ilike ${searchLike}
      )
      and (
        ${role}::text is null
        or exists (
          select 1
          from user_roles ur
          join roles r
            on r.id = ur.role_id
           and r.tenant_id = ur.tenant_id
           and r.deleted_at is null
          where ur.tenant_id = m.tenant_id
            and ur.membership_id = m.id
            and r.key = ${role}
        )
      )
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
    accountEmail: row.account_email,
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
    archivedAt: row.archived_at,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_key,
        }
      : null,
    roles: row.roles_json ?? [],
  }));

  const totalRows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from memberships m
    left join member_profiles mp
      on mp.tenant_id = m.tenant_id
     and mp.membership_id = m.id
     and mp.deleted_at is null
    left join auth_principals ap
      on ap.id = m.auth_principal_id
    where m.tenant_id = ${args.tenantId}::uuid
      and m.status <> 'REMOVED'
      and (${args.query.status ?? null}::text is null or m.status::text = ${args.query.status ?? null})
      and (
        ${searchLike}::text is null
        or mp.display_name ilike ${searchLike}
        or m.invited_email_normalized ilike ${searchLike}
        or ap.email ilike ${searchLike}
      )
      and (
        ${role}::text is null
        or exists (
          select 1
          from user_roles ur
          join roles r
            on r.id = ur.role_id
           and r.tenant_id = ur.tenant_id
           and r.deleted_at is null
          where ur.tenant_id = m.tenant_id
            and ur.membership_id = m.id
            and r.key = ${role}
        )
      )
  `;

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
    totalCount: Number(totalRows[0]?.count ?? 0n),
  };
}

export async function getMemberStatsForTenant(args: {
  tx: Tx;
  tenantId: string;
  activeWindowMinutes: number;
}): Promise<{
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  suspendedMembers: number;
  activeNow: number;
  courseCompletionRate: number | null;
}> {
  const statusRows = await args.tx.$queryRaw<
    Array<{
      total_members: bigint;
      active_members: bigint;
      pending_invites: bigint;
      suspended_members: bigint;
      active_now: bigint;
    }>
  >`
    select
      count(*) filter (where status <> 'REMOVED')::bigint as total_members,
      count(*) filter (where status = 'ACTIVE' and archived_at is null)::bigint as active_members,
      count(*) filter (where status = 'INVITED')::bigint as pending_invites,
      count(*) filter (where status = 'SUSPENDED')::bigint as suspended_members,
      count(*) filter (
        where status = 'ACTIVE'
          and archived_at is null
          and last_active_at is not null
          and last_active_at >= now() - make_interval(mins => ${args.activeWindowMinutes})
      )::bigint as active_now
    from memberships
    where tenant_id = ${args.tenantId}::uuid
  `;

  const completionRows = await args.tx.$queryRaw<
    Array<{ total_enrollments: bigint; completed_enrollments: bigint }>
  >`
    select
      count(*) filter (where status = 'active')::bigint as total_enrollments,
      count(*) filter (where status = 'active' and completed_at is not null)::bigint as completed_enrollments
    from enrollments
    where tenant_id = ${args.tenantId}::uuid
  `;

  const status = statusRows[0];
  const completion = completionRows[0];

  const totalEnrollments = Number(completion?.total_enrollments ?? 0n);
  const completedEnrollments = Number(completion?.completed_enrollments ?? 0n);

  return {
    totalMembers: Number(status?.total_members ?? 0n),
    activeMembers: Number(status?.active_members ?? 0n),
    pendingInvites: Number(status?.pending_invites ?? 0n),
    suspendedMembers: Number(status?.suspended_members ?? 0n),
    activeNow: Number(status?.active_now ?? 0n),
    courseCompletionRate:
      totalEnrollments > 0 ? completedEnrollments / totalEnrollments : null,
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

export async function refreshInviteTokenRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  inviteTokenHash: string;
  inviteExpiresAt: Date;
}): Promise<{ id: string; invitedEmail: string | null; inviteExpiresAt: Date } | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      invited_email_normalized: string | null;
      invite_expires_at: Date;
    }>
  >`
    update memberships
    set
      invite_token_hash = ${args.inviteTokenHash},
      invite_expires_at = ${args.inviteExpiresAt}::timestamptz,
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.membershipId}::uuid
      and status = 'INVITED'
      and accepted_at is null
    returning id::text, invited_email_normalized, invite_expires_at
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    invitedEmail: row.invited_email_normalized,
    inviteExpiresAt: row.invite_expires_at,
  };
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

export type MemberProfileRecord = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  profileVisibility: "PUBLIC" | "PRIVATE";
};

export async function updateMemberProfileRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
  profileVisibility?: "PUBLIC" | "PRIVATE";
}): Promise<MemberProfileRecord> {
  const profileId = createUuidV7();

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      display_name: string | null;
      avatar_key: string | null;
      bio: string | null;
      timezone: string | null;
      profile_visibility: "PUBLIC" | "PRIVATE";
    }>
  >`
    insert into member_profiles (
      id,
      tenant_id,
      membership_id,
      display_name,
      avatar_key,
      bio,
      timezone,
      profile_visibility,
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
      ${args.timezone ?? null},
      coalesce(${args.profileVisibility ?? null}::"ProfileVisibility", 'PUBLIC'::"ProfileVisibility"),
      now(),
      now()
    )
    on conflict (membership_id)
    do update set
      display_name = coalesce(excluded.display_name, member_profiles.display_name),
      avatar_key = coalesce(excluded.avatar_key, member_profiles.avatar_key),
      bio = coalesce(excluded.bio, member_profiles.bio),
      timezone = coalesce(excluded.timezone, member_profiles.timezone),
      profile_visibility = coalesce(
        ${args.profileVisibility ?? null}::"ProfileVisibility",
        member_profiles.profile_visibility
      ),
      updated_at = now(),
      deleted_at = null
    returning
      id::text,
      display_name,
      avatar_key,
      bio,
      timezone,
      profile_visibility
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
    timezone: row.timezone,
    profileVisibility: row.profile_visibility,
  };
}

/** Explicitly clears the stored avatar (the upsert's coalesce keeps old values on null, so removal needs a direct update). */
export async function clearMemberAvatarKey(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<void> {
  await args.tx.$queryRaw`
    update member_profiles
    set avatar_key = null, updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
  `;
}

/**
 * Reads the free-form `member_profiles.metadata_json` blob for a membership.
 * Used to persist extensible learner settings (appearance, locale, learning,
 * and privacy preferences) without a schema migration. Always returns an
 * object so callers can merge safely.
 */
export async function readMemberProfileMetadata(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<Record<string, unknown>> {
  const rows = await args.tx.$queryRaw<Array<{ metadata_json: unknown }>>`
    select metadata_json
    from member_profiles
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and deleted_at is null
    limit 1
  `;

  const raw = rows[0]?.metadata_json;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Upserts the `member_profiles.metadata_json` blob. Creates the profile row
 * when the learner has not saved one yet (profile_visibility falls back to its
 * column default), otherwise replaces the metadata for the existing row.
 */
export async function writeMemberProfileMetadata(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const profileId = createUuidV7();
  const json = JSON.stringify(args.metadata);

  await args.tx.$queryRaw`
    insert into member_profiles (
      id,
      tenant_id,
      membership_id,
      metadata_json,
      created_at,
      updated_at
    )
    values (
      ${profileId}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${json}::jsonb,
      now(),
      now()
    )
    on conflict (membership_id)
    do update set
      metadata_json = ${json}::jsonb,
      updated_at = now(),
      deleted_at = null
  `;
}

export async function findMemberProfileRecord(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<MemberProfileRecord | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      display_name: string | null;
      avatar_key: string | null;
      bio: string | null;
      timezone: string | null;
      profile_visibility: "PUBLIC" | "PRIVATE";
    }>
  >`
    select
      id::text,
      display_name,
      avatar_key,
      bio,
      timezone,
      profile_visibility
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
    timezone: row.timezone,
    profileVisibility: row.profile_visibility,
  };
}
