import type { TenantTx } from "@atlas/db";
import { courseNotFound } from "./courses.errors";
import { findCourseAuthProjection } from "./courses.repository";
import { listCourseLearnerProgress } from "./course-progress.repository";
import type { CourseProgressListQuery } from "./course-progress.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function listCourseProgress(
  tx: TenantTx,
  ctx: ServiceCtx,
  courseId: string,
  query: CourseProgressListQuery,
) {
  const course = await findCourseAuthProjection({ tx, courseId });

  if (!course || course.tenantId !== ctx.tenantId) {
    throw courseNotFound();
  }

  const page = await listCourseLearnerProgress({
    tx,
    courseId,
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const isInstructor = course.createdByMembershipId === ctx.actorMembershipId;
  const items = isInstructor
    ? page.items
    : page.items.filter((item) => item.membershipId === ctx.actorMembershipId);

  return {
    data: {
      items,
      pageInfo: isInstructor ? page.pageInfo : { nextCursor: null, hasNextPage: false },
    },
  };
}
