import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { MemberProfileProjection } from "./types";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function findMemberProfile(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<MemberProfileProjection | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      membership_id: string;
      display_name: string | null;
      avatar_key: string | null;
    }>
  >`
    select
      id::text,
      membership_id::text,
      display_name,
      avatar_key
    from member_profiles
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_key,
  };
}

export async function createMemberProfileIfMissing(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  displayName?: string | null;
}): Promise<MemberProfileProjection> {
  const existing = await findMemberProfile(args);
  if (existing) {
    return existing;
  }

  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      membership_id: string;
      display_name: string | null;
      avatar_key: string | null;
    }>
  >`
    insert into member_profiles (
      id,
      tenant_id,
      membership_id,
      display_name,
      avatar_key
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.displayName ?? null},
      null
    )
    returning
      id::text,
      membership_id::text,
      display_name,
      avatar_key
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to create member profile");
  }

  return {
    id: row.id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_key,
  };
}
