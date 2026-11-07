import { can, createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";

/**
 * Who may manage a course in the studio: the course's creator, or a role that
 * bypasses resource checks (admins and owners).
 *
 * Studio services used to compare the course's creator with the actor
 * directly. That refused admins and owners on another author's course even
 * though the routes' own `course.update` check lets them through, so they
 * couldn't open the course editor or settings (found on staging, 7 November
 * 2026). This asks `can()` the same question the routes ask, so permission
 * overrides and role changes apply here too. Another instructor is still
 * refused: `course.update` requires ownership unless the role bypasses it.
 */

type AccessCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId?: string | undefined;
};

async function allowedToUpdate(
  tx: TenantTx,
  ctx: AccessCtx,
  resource: { id: string; ownerMembershipId: string | null },
): Promise<boolean> {
  const decision = await can({
    tx,
    actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
    permission: "course.update",
    resource: createTenantResourceRef({
      type: "course",
      id: resource.id,
      tenantId: ctx.tenantId,
      ownerMembershipId: resource.ownerMembershipId,
    }),
    ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId ?? "course-studio-access" },
  });
  return decision.allowed;
}

/** True for the course's creator, and for admins and owners. */
export async function canManageCourse(
  tx: TenantTx,
  ctx: AccessCtx,
  course: { id: string; createdByMembershipId: string | null },
): Promise<boolean> {
  if (course.createdByMembershipId === ctx.actorMembershipId) return true;
  return allowedToUpdate(tx, ctx, {
    id: course.id,
    ownerMembershipId: course.createdByMembershipId,
  });
}

/**
 * True when the actor may manage every course in the tenant (admins and
 * owners), so the studio catalog lists all courses instead of their own.
 */
export async function canManageEveryCourse(tx: TenantTx, ctx: AccessCtx): Promise<boolean> {
  return allowedToUpdate(tx, ctx, { id: ctx.tenantId, ownerMembershipId: null });
}
