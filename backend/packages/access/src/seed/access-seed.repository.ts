import { PERMISSIONS } from "./permission-catalogue";
import { ROLE_PERMISSIONS } from "./role-permission-matrix";
import { TENANT_SYSTEM_ROLES } from "./tenant-system-roles";
import { stableAccessSeedId } from "./stable-seed-id";

type Db = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function seedPermissions(db: Db): Promise<void> {
  for (const permission of PERMISSIONS) {
    await db.$queryRaw`
      insert into permissions (
        id,
        key,
        description,
        created_at
      )
      values (
        ${stableAccessSeedId("permission", permission.key)}::uuid,
        ${permission.key},
        ${permission.description},
        now()
      )
      on conflict (key)
      do update set
        description = excluded.description
    `;
  }
}

export async function seedTenantSystemRoles(args: { tx: Db; tenantId: string }): Promise<void> {
  for (const role of TENANT_SYSTEM_ROLES) {
    const roleId = stableAccessSeedId("role", `${args.tenantId}:${role.key}`);
    const lockKey = `${args.tenantId}:role:${role.key}`;

    await args.tx.$queryRaw`
      with locked as (
        select pg_advisory_xact_lock(hashtext(${lockKey}))
      ),
      updated as (
        update roles r
        set
          name = ${role.name},
          is_system = true,
          updated_at = now()
        from locked
        where r.tenant_id = ${args.tenantId}::uuid
          and r.key = ${role.key}
          and r.deleted_at is null
        returning r.id
      )
      insert into roles (
        id,
        tenant_id,
        key,
        name,
        is_system,
        created_at,
        updated_at
      )
      select
        ${roleId}::uuid,
        ${args.tenantId}::uuid,
        ${role.key},
        ${role.name},
        true,
        now(),
        now()
      where not exists (select 1 from updated)
      on conflict (id) do update set
        name = excluded.name,
        is_system = true,
        updated_at = now(),
        deleted_at = null
    `;
  }
}

export async function seedTenantRolePermissions(args: { tx: Db; tenantId: string }): Promise<void> {
  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionKey of permissionKeys) {
      const rolePermissionId = stableAccessSeedId(
        "role_permission",
        `${args.tenantId}:${roleKey}:${permissionKey}`,
      );

      await args.tx.$queryRaw`
        insert into role_permissions (
          id,
          tenant_id,
          role_id,
          permission_key,
          created_at
        )
        select
          ${rolePermissionId}::uuid,
          ${args.tenantId}::uuid,
          r.id,
          ${permissionKey},
          now()
        from roles r
        where r.tenant_id = ${args.tenantId}::uuid
          and r.key = ${roleKey}
          and r.deleted_at is null
        on conflict (tenant_id, role_id, permission_key)
        do nothing
      `;
    }
  }
}

export async function assignSystemRoleToMembership(args: {
  tx: Db;
  tenantId: string;
  membershipId: string;
  roleKey: string;
  assignedByMembershipId: string | null;
}): Promise<void> {
  const userRoleId = stableAccessSeedId(
    "user_role",
    `${args.tenantId}:${args.membershipId}:${args.roleKey}`,
  );

  await args.tx.$queryRaw`
    insert into user_roles (
      id,
      tenant_id,
      membership_id,
      role_id,
      assigned_by_membership_id,
      created_at
    )
    select
      ${userRoleId}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      r.id,
      ${args.assignedByMembershipId}::uuid,
      now()
    from roles r
    where r.tenant_id = ${args.tenantId}::uuid
      and r.key = ${args.roleKey}
      and r.deleted_at is null
    on conflict (tenant_id, membership_id, role_id)
    do nothing
  `;
}
