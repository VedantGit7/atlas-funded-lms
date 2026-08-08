import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertTenantScopedPermissionKeys } from "./permission-validation";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function findActorEffectivePermissionKeys(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<Set<string>> {
  const roleRows = await args.tx.$queryRaw<Array<{ permission_key: string }>>`
    select distinct rp.permission_key
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
  `;

  const overrideRows = await args.tx.$queryRaw<Array<{ permission_key: string }>>`
    select po.permission_key
    from permission_overrides po
    where po.tenant_id = ${args.tenantId}::uuid
      and po.membership_id = ${args.membershipId}::uuid
      and po.effect = 'ALLOW'
      and (po.expires_at is null or po.expires_at > now())
  `;

  const keys = new Set<string>();
  for (const row of roleRows) {
    keys.add(row.permission_key);
  }
  for (const row of overrideRows) {
    keys.add(row.permission_key);
  }

  return keys;
}

export function assertNoGrantUp(args: {
  actorPermissionKeys: ReadonlySet<string>;
  requestedPermissionKeys: readonly string[];
}): void {
  assertTenantScopedPermissionKeys(args.requestedPermissionKeys);

  const missing = args.requestedPermissionKeys.filter((key) => !args.actorPermissionKeys.has(key));

  if (missing.length > 0) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "You cannot grant permissions you do not hold.",
    });
  }
}

export async function enforceNoGrantUp(args: {
  tx: Tx;
  tenantId: string;
  actorMembershipId: string;
  requestedPermissionKeys: readonly string[];
}): Promise<void> {
  const actorKeys = await findActorEffectivePermissionKeys({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: args.actorMembershipId,
  });

  assertNoGrantUp({
    actorPermissionKeys: actorKeys,
    requestedPermissionKeys: args.requestedPermissionKeys,
  });
}
