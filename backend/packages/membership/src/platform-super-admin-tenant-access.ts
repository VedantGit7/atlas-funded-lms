import { withPlatformScope, type PlatformPermission } from "@atlas/db";
import {
  assignSystemRoleToMembership,
  parsePlatformOperatorAssignments,
  resolvePlatformPermissionsForRole,
  seedTenantRolePermissions,
  seedTenantSystemRoles,
} from "@atlas/access";

/**
 * Tenant role granted to the platform super admin when it authenticates against
 * a tenant. Tenants have no "super admin" role, so `admin` is the highest
 * day-to-day administration role we map onto.
 */
const ELEVATION_ROLE_KEY = "admin";

type QueryableDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

function isPlatformSuperAdmin(email: string): boolean {
  const assignments = parsePlatformOperatorAssignments(
    process.env["PLATFORM_OPERATOR_ASSIGNMENTS"] ?? "",
  );
  return assignments.get(email.trim().toLowerCase()) === "super_admin";
}

async function resolvePrincipalIdByEmail(db: QueryableDb, email: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    select id::text
    from auth_principals
    where email_normalized = ${email.trim().toLowerCase()}
    limit 1
  `;
  return rows[0]?.id ?? null;
}

async function hasProvisionedSuperAdminAccess(
  tx: QueryableDb,
  tenantId: string,
  principalId: string,
): Promise<boolean> {
  // RLS on memberships/user_roles requires app.tenant_id. The global-db handle
  // used by route handlers does not set it automatically.
  await tx.$executeRaw`
    SELECT set_config('app.tenant_id', ${tenantId}, true)
  `;

  const rows = await tx.$queryRaw<{ ok: boolean }[]>`
    select exists (
      select 1
      from memberships m
      inner join user_roles ur
        on ur.tenant_id = m.tenant_id
       and ur.membership_id = m.id
      inner join roles r
        on r.id = ur.role_id
       and r.tenant_id = ur.tenant_id
       and r.deleted_at is null
       and r.key = ${ELEVATION_ROLE_KEY}
      where m.tenant_id = ${tenantId}::uuid
        and m.auth_principal_id = ${principalId}::uuid
        and m.status = 'ACTIVE'
    ) as ok
  `;
  return rows[0]?.ok === true;
}

async function tenantHasAdminRole(db: QueryableDb, tenantId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ ok: boolean }[]>`
    select exists (
      select 1
      from roles
      where tenant_id = ${tenantId}::uuid
        and key = ${ELEVATION_ROLE_KEY}
        and deleted_at is null
    ) as ok
  `;
  return rows[0]?.ok === true;
}

async function ensureActiveMembership(
  tx: QueryableDb,
  tenantId: string,
  principalId: string,
  email: string,
): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    insert into memberships (
      id,
      tenant_id,
      auth_principal_id,
      status,
      invited_email_normalized,
      joined_at,
      accepted_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      ${tenantId}::uuid,
      ${principalId}::uuid,
      'ACTIVE',
      ${email.trim().toLowerCase()},
      now(),
      now(),
      now(),
      now()
    )
    on conflict (tenant_id, auth_principal_id)
    do update set
      status = 'ACTIVE',
      joined_at = coalesce(memberships.joined_at, now()),
      accepted_at = coalesce(memberships.accepted_at, now()),
      suspended_at = null,
      removed_at = null,
      updated_at = now()
    returning id::text
  `;

  const membershipId = rows[0]?.id;
  if (!membershipId) {
    throw new Error("Failed to provision platform super admin membership");
  }
  return membershipId;
}

/**
 * Ensures the global platform super admin holds an active tenant membership with
 * the `admin` role. Called on tenant sign-in and before membership resolution
 * on authenticated tenant API requests so direct navigation to `/admin` also
 * self-heals.
 *
 * Uses a cheap existence check so routine API traffic does not re-run the full
 * role-permission seed on every request (which caused Prisma transaction timeouts
 * when the admin shell fired many parallel loaders).
 */
export async function ensurePlatformSuperAdminTenantAccess(args: {
  db: QueryableDb;
  tenantId: string;
  requestId: string;
  email: string;
}): Promise<void> {
  if (!isPlatformSuperAdmin(args.email)) {
    return;
  }

  const principalId = await resolvePrincipalIdByEmail(args.db, args.email);
  if (!principalId) {
    return;
  }

  if (await hasProvisionedSuperAdminAccess(args.db, args.tenantId, principalId)) {
    return;
  }

  const platformPermissions = resolvePlatformPermissionsForRole(
    "super_admin",
  ) as readonly PlatformPermission[];

  await withPlatformScope(
    {
      principalId,
      requestId: args.requestId,
      requiredPermission: "platform.tenant.manage",
      platformPermissions,
      tenantId: args.tenantId,
      route: "auth.platform-super-admin.tenant-access",
    },
    "Provision platform super admin tenant admin access",
    async (tx) => {
      if (!(await tenantHasAdminRole(tx, args.tenantId))) {
        await seedTenantSystemRoles({ tx, tenantId: args.tenantId });
        await seedTenantRolePermissions({ tx, tenantId: args.tenantId });
      }

      const membershipId = await ensureActiveMembership(
        tx,
        args.tenantId,
        principalId,
        args.email,
      );

      await assignSystemRoleToMembership({
        tx,
        tenantId: args.tenantId,
        membershipId,
        roleKey: ELEVATION_ROLE_KEY,
        assignedByMembershipId: null,
      });
    },
  );
}
