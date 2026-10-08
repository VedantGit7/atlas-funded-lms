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

/**
 * Everything `can()` reads, in one round trip (audit §3.1): whether the
 * permission is in the catalogue, the membership's effective override (a live
 * DENY wins, then the newest ALLOW), and the roles granting it. Each part is
 * the same predicate as its single-purpose function below.
 */
export async function findAuthorizationFacts(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  permissionKey: string;
}): Promise<{
  permissionExists: boolean;
  override: PermissionOverrideDecision | null;
  grant: RolePermissionGrant | null;
}> {
  const rows = await args.tx.$queryRaw<
    Array<{
      permission_exists: boolean;
      override_effect: PermissionOverrideDecision["effect"] | null;
      role_keys: string[];
      bypasses_resource_predicates: boolean;
    }>
  >`
      select
        exists (select 1 from permissions where key = ${args.permissionKey}) as permission_exists,
        (
          select po.effect::text
          from permission_overrides po
          where po.tenant_id = ${args.tenantId}::uuid
            and po.membership_id = ${args.membershipId}::uuid
            and po.permission_key = ${args.permissionKey}
            and (po.expires_at is null or po.expires_at > now())
          order by
            case when po.effect = 'DENY' then 0 else 1 end,
            po.created_at desc
          limit 1
        ) as override_effect,
        coalesce(grants.role_keys, '{}'::text[]) as role_keys,
        coalesce(grants.bypasses_resource_predicates, false) as bypasses_resource_predicates
      from (
        select
          array_agg(distinct r.key) as role_keys,
          bool_or(r.bypasses_resource_predicates) as bypasses_resource_predicates
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
      ) as grants
    `;

  const row = rows[0];
  const roleKeys = row?.role_keys ?? [];

  return {
    permissionExists: row?.permission_exists ?? false,
    override: row?.override_effect
      ? { effect: row.override_effect, permissionKey: args.permissionKey }
      : null,
    grant:
      roleKeys.length > 0
        ? {
            permissionKey: args.permissionKey,
            roleKeys,
            bypassesResourcePredicates: row?.bypasses_resource_predicates ?? false,
          }
        : null,
  };
}

export async function findRolePermissionGrant(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  permissionKey: string;
}): Promise<RolePermissionGrant | null> {
  const rows = await args.tx.$queryRaw<
    Array<{ role_key: string; bypasses_resource_predicates: boolean }>
  >`
      select distinct r.key as role_key, r.bypasses_resource_predicates
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
    bypassesResourcePredicates: rows.some((row) => row.bypasses_resource_predicates),
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
