import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";
import { readInstructorMembershipIds } from "./course-detail-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export function courseInstructorIdsFromDetail(course: CourseDetail): string[] {
  return readInstructorMembershipIds(course.tags);
}

export function mergeCourseInstructorsIntoTags(
  tags: Record<string, unknown> | undefined,
  membershipIds: string[],
): Record<string, unknown> {
  const access = parseCourseAccessFromTags(tags);
  const uniqueIds = [...new Set(membershipIds.filter((id) => id.length > 0))];
  const nextTags = { ...(tags ?? {}) };

  if (uniqueIds.length > 0) {
    nextTags["instructorMembershipIds"] = uniqueIds;
  } else {
    delete nextTags["instructorMembershipIds"];
  }

  return mergeCourseAccessIntoTags(nextTags, access);
}

export function buildCourseInstructorsUpdatePayload(
  course: CourseDetail,
  membershipIds: string[],
) {
  return {
    tags: mergeCourseInstructorsIntoTags(course.tags, membershipIds),
  };
}
