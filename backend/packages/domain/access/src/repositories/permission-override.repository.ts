import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export function permissionOverrideNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Permission override not found.",
  });
}

export async function listPermissionOverridesPaginated(args: {
  tx: Tx;
  tenantId: string;
  membershipId?: string;
  limit: number;
  cursor?: string;
}) {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      membership_id: string;
      permission_key: string;
      effect: string;
      reason: string | null;
      expires_at: Date | null;
      created_at: Date;
    }>
  >`
    select
      id::text,
      membership_id::text,
      permission_key,
      effect,
      reason,
      expires_at,
      created_at
    from permission_overrides
    where tenant_id = ${args.tenantId}::uuid
      and (${args.membershipId ?? null}::uuid is null or membership_id = ${args.membershipId ?? null}::uuid)
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (created_at, id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by created_at desc, id desc
    limit ${args.limit + 1}
  `;

  const hasNextPage = rows.length > args.limit;
  const pageRows = hasNextPage ? rows.slice(0, args.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      membershipId: row.membership_id,
      permissionKey: row.permission_key,
      effect: row.effect as "ALLOW" | "DENY",
      reason: row.reason,
      expiresAt: row.expires_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    })),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last ? encodeListCursor({ createdAt: last.created_at, id: last.id }) : null,
    },
  };
}

export async function insertPermissionOverride(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  permissionKey: string;
  effect: "ALLOW" | "DENY";
  reason?: string | null;
  expiresAt?: Date | null;
}) {
  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      membership_id: string;
      permission_key: string;
      effect: string;
      reason: string | null;
      expires_at: Date | null;
      created_at: Date;
    }>
  >`
    insert into permission_overrides (
      id,
      tenant_id,
      membership_id,
      permission_key,
      effect,
      reason,
      expires_at,
      created_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.permissionKey},
      ${args.effect},
      ${args.reason ?? null},
      ${args.expiresAt ?? null}::timestamptz,
      now()
    )
    on conflict (tenant_id, membership_id, permission_key)
    do update set
      effect = excluded.effect,
      reason = excluded.reason,
      expires_at = excluded.expires_at,
      created_at = now()
    returning
      id::text,
      membership_id::text,
      permission_key,
      effect,
      reason,
      expires_at,
      created_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create permission override");

  return {
    id: row.id,
    membershipId: row.membership_id,
    permissionKey: row.permission_key,
    effect: row.effect as "ALLOW" | "DENY",
    reason: row.reason,
    expiresAt: row.expires_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function deletePermissionOverrideById(args: {
  tx: Tx;
  tenantId: string;
  overrideId: string;
}): Promise<{ id: string } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    delete from permission_overrides
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.overrideId}::uuid
    returning id::text
  `;

  const row = rows[0];
  if (!row) return null;
  return { id: row.id };
}
