import type { PermissionOverrideDecision, RolePermissionGrant } from "./types";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function permissionExists(args: {
  tx: Tx;
  permissionKey: string;
}): Promise<{ exists: boolean; platformOnly: boolean }> {
  const rows = await args.tx.$queryRaw<Array<{ key: string }>>`
      select key
      from permissions
      where key = ${args.permissionKey}
      limit 1
    `;

  const row = rows[0];

  return {
    exists: Boolean(row),
    platformOnly: args.permissionKey.startsWith("platform."),
  };
}

export async function findRolePermissionGrant(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  permissionKey: string;
}): Promise<RolePermissionGrant | null> {
  const rows = await args.tx.$queryRaw<Array<{ role_key: string }>>`
      select distinct r.key as role_key
      from user_roles ur
      join roles r
        on r.id = ur.role_id
       and r.tenant_id = ur.tenant_id
       and r.deleted_at is null
      join role_permissions rp
        on rp.role_id = r.id
       and rp.tenant_id = r.tenant_id
      where ur.tenant_id = ${args.tenantId}::uuid
        and ur.membership_id = ${args.membershipId}::uuid
        and rp.permission_key = ${args.permissionKey}
    `;

  if (rows.length === 0) {
    return null;
  }

  return {
    permissionKey: args.permissionKey,
    roleKeys: rows.map((row) => row.role_key),
  };
}

export async function findPermissionOverride(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  permissionKey: string;
}): Promise<PermissionOverrideDecision | null> {
  const rows = await args.tx.$queryRaw<
    Array<{ effect: PermissionOverrideDecision["effect"]; permission_key: string }>
  >`
      select
        po.effect::text as effect,
        po.permission_key
      from permission_overrides po
      where po.tenant_id = ${args.tenantId}::uuid
        and po.membership_id = ${args.membershipId}::uuid
        and po.permission_key = ${args.permissionKey}
        and (po.expires_at is null or po.expires_at > now())
      order by
        case when po.effect = 'DENY' then 0 else 1 end,
        po.created_at desc
      limit 1
    `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    effect: row.effect,
    permissionKey: row.permission_key,
  };
}
