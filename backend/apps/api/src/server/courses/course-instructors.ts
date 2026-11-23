import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { listHeldPermissionKeys } from "@atlas/authorization";

/**
 * A course's instructors are kept in its tags as `instructorMembershipIds` and
 * shown to learners as the course's creators. Only staff may be named: the
 * Studio picker once pre-selected a learner, who was then credited as "Course
 * creator" (QA review 1 C17, review 2 H3).
 *
 * Only ids being added are checked, so a course saved before this check, with
 * a learner already listed, can still be edited and the learner removed.
 */
const TEACHING_PERMISSIONS = ["course.create", "course.update"] as const;

export function readInstructorIds(tags: unknown): string[] {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return [];
  const raw = (tags as Record<string, unknown>)["instructorMembershipIds"];
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

export async function assertNewInstructorsAreStaff(args: {
  tx: TenantTx;
  tenantId: string;
  nextTags: unknown;
  previousTags: unknown;
}): Promise<void> {
  const previous = new Set(readInstructorIds(args.previousTags));
  const added = [...new Set(readInstructorIds(args.nextTags))].filter((id) => !previous.has(id));
  if (added.length === 0) return;

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const membershipId of added) {
    const live =
      uuid.test(membershipId) &&
      (
        await args.tx.$queryRaw<Array<{ id: string }>>`
          select id::text from memberships
          where id = ${membershipId}::uuid
            and tenant_id = ${args.tenantId}::uuid
            and status in ('ACTIVE', 'INVITED')
        `
      ).length > 0;
    const teaches =
      live &&
      (
        await listHeldPermissionKeys({
          tx: args.tx,
          tenantId: args.tenantId,
          membershipId,
          permissionKeys: TEACHING_PERMISSIONS,
        })
      ).length > 0;
    if (!teaches) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message:
          "Only instructors, admins and the owner can be a course's instructor. Give the person an instructor role first.",
      });
    }
  }
}
