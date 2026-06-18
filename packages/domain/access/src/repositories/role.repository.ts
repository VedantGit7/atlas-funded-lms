import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw?(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function roleNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Role not found.",
  });
}

export async function listRolesPaginated(args: {
  tx: Tx;
  tenantId: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: RoleRow[]; pageInfo: { nextCursor: string | null; hasNextPage: boolean } }> {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
    from roles
    where tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (created_at, id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by created_at desc, id desc
    limit ${args.limit + 1}
  `;

  const hasNextPage = rows.length > args.limit;
  const pageRows = hasNextPage ? rows.slice(0, args.limit) : rows;

  const items = pageRows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const last = pageRows[pageRows.length - 1];

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last ? encodeListCursor({ createdAt: last.created_at, id: last.id }) : null,
    },
  };
}

export async function findRoleById(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
}): Promise<RoleRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
    from roles
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.roleId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function requireRoleById(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
}): Promise<RoleRow> {
  const role = await findRoleById(args);
  if (!role) throw roleNotFound();
  return role;
}

export async function listRolePermissionKeys(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
}): Promise<string[]> {
  const rows = await args.tx.$queryRaw<Array<{ permission_key: string }>>`
    select permission_key
    from role_permissions
    where tenant_id = ${args.tenantId}::uuid
      and role_id = ${args.roleId}::uuid
    order by permission_key asc
  `;

  return rows.map((row) => row.permission_key);
}

export async function findRoleByKey(args: {
  tx: Tx;
  tenantId: string;
  roleKey: string;
}): Promise<RoleRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
    from roles
    where tenant_id = ${args.tenantId}::uuid
      and key = ${args.roleKey}
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertCustomRole(args: {
  tx: Tx;
  tenantId: string;
  key: string;
  name: string;
}): Promise<RoleRow> {
  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    insert into roles (
      id,
      tenant_id,
      key,
      name,
      is_system,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.key},
      ${args.name},
      false,
      now(),
      now()
    )
    returning
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create role");

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function replaceRolePermissions(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
  permissionKeys: readonly string[];
}): Promise<void> {
  await args.tx.$queryRaw`
    delete from role_permissions
    where tenant_id = ${args.tenantId}::uuid
      and role_id = ${args.roleId}::uuid
  `;

  for (const permissionKey of args.permissionKeys) {
    const id = createUuidV7();
    await args.tx.$queryRaw`
      insert into role_permissions (
        id,
        tenant_id,
        role_id,
        permission_key,
        created_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.roleId}::uuid,
        ${permissionKey},
        now()
      )
    `;
  }
}

export async function updateRoleMetadata(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
  name?: string;
}): Promise<RoleRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    update roles
    set
      name = coalesce(${args.name ?? null}, name),
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.roleId}::uuid
      and deleted_at is null
    returning
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function softDeleteRole(args: {
  tx: Tx;
  tenantId: string;
  roleId: string;
}): Promise<RoleRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      key: string;
      name: string;
      is_system: boolean;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    update roles
    set
      deleted_at = now(),
      updated_at = now()
    where tenant_id = ${args.tenantId}::uuid
      and id = ${args.roleId}::uuid
      and deleted_at is null
      and is_system = false
    returning
      id::text,
      key,
      name,
      is_system,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function permissionKeysExist(args: {
  tx: Tx;
  permissionKeys: readonly string[];
}): Promise<boolean> {
  if (args.permissionKeys.length === 0) return true;

  for (const permissionKey of args.permissionKeys) {
    const rows = await args.tx.$queryRaw<Array<{ key: string }>>`
      select key
      from permissions
      where key = ${permissionKey}
      limit 1
    `;

    if (!rows[0]) {
      return false;
    }
  }

  return true;
}

export async function insertUserRole(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  roleId: string;
  assignedByMembershipId: string;
}): Promise<{ id: string; created: boolean }> {
  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    insert into user_roles (
      id,
      tenant_id,
      membership_id,
      role_id,
      assigned_by_membership_id,
      created_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.roleId}::uuid,
      ${args.assignedByMembershipId}::uuid,
      now()
    )
    on conflict (tenant_id, membership_id, role_id) do nothing
    returning id::text
  `;

  if (rows[0]) {
    return { id: rows[0].id, created: true };
  }

  const existing = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from user_roles
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and role_id = ${args.roleId}::uuid
    limit 1
  `;

  if (!existing[0]) {
    throw new Error("Failed to assign role");
  }

  return { id: existing[0].id, created: false };
}

export async function deleteUserRole(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  roleId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    delete from user_roles
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and role_id = ${args.roleId}::uuid
    returning id::text
  `;

  return rows.length > 0;
}

export async function listActorRoleKeys(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<string[]> {
  const rows = await args.tx.$queryRaw<Array<{ key: string }>>`
    select r.key
    from user_roles ur
    join roles r on r.id = ur.role_id and r.tenant_id = ur.tenant_id and r.deleted_at is null
    where ur.tenant_id = ${args.tenantId}::uuid
      and ur.membership_id = ${args.membershipId}::uuid
  `;

  return rows.map((row) => row.key);
}

function mapRoleView(role: RoleRow, permissions: string[]) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    isSystem: role.isSystem,
    permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export { mapRoleView };
