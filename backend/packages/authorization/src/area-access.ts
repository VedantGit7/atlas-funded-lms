import { listHeldPermissionKeys } from "./authorization.repository";

type Tx = Parameters<typeof listHeldPermissionKeys>[0]["tx"];

/**
 * Studio is for people who build or grade content. Holding any one of these
 * opens it; learners hold none (QA review 1 C20, m44: a learner could open
 * Studio and its Create course dialog, and saving failed silently).
 *
 * Permissions rather than role keys, so a custom role that can edit courses
 * gets Studio too, and a permission override (DENY) takes it away.
 */
export const STUDIO_ACCESS_PERMISSIONS = [
  "course.create",
  "course.update",
  "item.create",
  "item.update",
  "assessment.create",
  "assessment.update",
  "assessment.grade",
  "learning_path.create",
  "learning_path.update",
] as const;

/**
 * The member's roles and whether they may use Studio, in one statement: what
 * GET /api/v1/me needs on every page load, without a round trip more than the
 * roles alone (tests/integration/api/hot-path-round-trips.test.ts). The Studio
 * rule is `listHeldPermissionKeys` over STUDIO_ACCESS_PERMISSIONS.
 */
export async function loadMembershipRolesAndStudioAccess(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<{
  roles: Array<{ id: string; key: string; name: string; isSystem: boolean }>;
  studioAccess: boolean;
}> {
  const keys = [...STUDIO_ACCESS_PERMISSIONS];
  const rows = await args.tx.$queryRaw<
    Array<{
      roles: Array<{ id: string; key: string; name: string; isSystem: boolean }> | null;
      studio_access: boolean;
    }>
  >`
      with member_roles as (
        select r.id, r.key, r.name, r.is_system
        from user_roles ur
        join roles r
          on r.id = ur.role_id
         and r.tenant_id = ur.tenant_id
         and r.deleted_at is null
        where ur.tenant_id = ${args.tenantId}::uuid
          and ur.membership_id = ${args.membershipId}::uuid
      ),
      granted as (
        select rp.permission_key as key
        from member_roles mr
        join role_permissions rp
          on rp.role_id = mr.id
         and rp.tenant_id = ${args.tenantId}::uuid
        where rp.permission_key = any(${keys}::text[])
        union
        select po.permission_key as key
        from permission_overrides po
        where po.tenant_id = ${args.tenantId}::uuid
          and po.membership_id = ${args.membershipId}::uuid
          and po.permission_key = any(${keys}::text[])
          and po.effect = 'ALLOW'
          and (po.expires_at is null or po.expires_at > now())
      )
      select
        (
          select json_agg(
            json_build_object('id', mr.id::text, 'key', mr.key, 'name', mr.name, 'isSystem', mr.is_system)
            order by mr.key
          )
          from member_roles mr
        ) as roles,
        exists (
          select 1
          from granted g
          where not exists (
            select 1
            from permission_overrides po
            where po.tenant_id = ${args.tenantId}::uuid
              and po.membership_id = ${args.membershipId}::uuid
              and po.permission_key = g.key
              and po.effect = 'DENY'
              and (po.expires_at is null or po.expires_at > now())
          )
        ) as studio_access
    `;
  const row = rows[0];
  return { roles: row?.roles ?? [], studioAccess: row?.studio_access ?? false };
}

export async function hasStudioAccess(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<boolean> {
  const held = await listHeldPermissionKeys({
    ...args,
    permissionKeys: STUDIO_ACCESS_PERMISSIONS,
  });
  return held.length > 0;
}
