import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { MemberDetailResponse } from "@atlas/contracts/membership/schemas/admin-members";
import { ClientApiError, clientApi, type ClientApiMutationOptions } from "../../../lib/client-api";
import { buildCourseInstructorsUpdatePayload } from "./course-instructor-settings";
import {
  loadInstructorMembers,
  type InstructorMember,
} from "./create-course-add-member-dialog";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export function formatCourseInstructorError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to save instructors.";
}

export async function saveCourseInstructors(
  course: CourseDetail,
  membershipIds: string[],
  options?: ClientApiMutationOptions,
): Promise<CourseDetail> {
  const response = await clientApi.put<{ data: CourseDetail }>(
    `/api/v1/courses/${course.id}`,
    buildCourseInstructorsUpdatePayload(course, membershipIds),
    "course-instructors-save",
    options,
  );
  return response.data;
}

export async function removeCourseInstructor(
  course: CourseDetail,
  membershipId: string,
  membershipIds: string[],
  displayName?: string | null,
): Promise<CourseDetail> {
  const nextIds = membershipIds.filter((id) => id !== membershipId);

  return saveCourseInstructors(course, nextIds, {
    successMessage: displayName
      ? `"${displayName}" removed from instructors successfully`
      : "Instructor removed successfully",
  });
}

export async function attachCourseInstructor(
  course: CourseDetail,
  membershipIds: string[],
  membershipId: string,
  displayName?: string | null,
): Promise<CourseDetail> {
  if (membershipIds.includes(membershipId)) {
    return course;
  }

  return saveCourseInstructors(course, [...membershipIds, membershipId], {
    successMessage: displayName
      ? `"${displayName}" added as instructor successfully`
      : "Instructor added successfully",
  });
}

function mapMemberDetailToInstructor(data: MemberDetailResponse["data"]): InstructorMember {
  const email = data.invitedEmail ?? "";
  const displayName = data.profile?.displayName?.trim() || email.split("@")[0] || "Member";
  return {
    membershipId: data.id,
    displayName,
    email,
    avatarUrl: data.profile?.avatarUrl ?? null,
    status: data.status,
  };
}

export async function resolveInstructorMembersByIds(
  membershipIds: string[],
): Promise<{ instructors: InstructorMember[]; unresolvedIds: string[] }> {
  if (membershipIds.length === 0) {
    return { instructors: [], unresolvedIds: [] };
  }

  const catalog = await loadInstructorMembers();
  const byId = new Map(catalog.map((member) => [member.membershipId, member]));
  const missingIds = membershipIds.filter((id) => !byId.has(id));

  await Promise.all(
    missingIds.map(async (membershipId) => {
      try {
        const response = await clientApi.get<MemberDetailResponse>(
          `/api/v1/members/${membershipId}`,
        );
        byId.set(membershipId, mapMemberDetailToInstructor(response.data));
      } catch {
        // Leave unresolved; caller can surface a fallback row.
      }
    }),
  );

  const instructors: InstructorMember[] = [];
  const unresolvedIds: string[] = [];

  for (const membershipId of membershipIds) {
    const member = byId.get(membershipId);
    if (member) {
      instructors.push(member);
    } else {
      unresolvedIds.push(membershipId);
    }
  }

  return { instructors, unresolvedIds };
}
