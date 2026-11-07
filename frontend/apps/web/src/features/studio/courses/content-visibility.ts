import type { z } from "zod";
import type {
  contentVisibilityResponseSchema,
  publishStatusStudioSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { clientApi } from "../../../lib/client-api";

/**
 * Showing and hiding single sections and lessons.
 *
 * Hidden content is stored as ARCHIVED: learners never see it, and approving
 * the course leaves it hidden. It can be changed while the course is a draft
 * (shown content goes live on the next approval) or live (the change reaches
 * learners at once), but not while the course is in review or archived.
 */

type PublishStatus = z.infer<typeof publishStatusStudioSchema>;
type ContentVisibilityResponse = z.infer<typeof contentVisibilityResponseSchema>;

export function isContentHidden(status: PublishStatus): boolean {
  return status === "ARCHIVED";
}

export function canChangeContentVisibility(courseStatus: PublishStatus): boolean {
  return courseStatus === "DRAFT" || courseStatus === "PUBLISHED";
}

export function visibilityActionLabel(hidden: boolean): string {
  return hidden ? "Show to learners" : "Hide from learners";
}

/** One line for the chapters panel explaining what show and hide do right now. */
export function contentVisibilityNotice(courseStatus: PublishStatus): string | null {
  switch (courseStatus) {
    case "PUBLISHED":
      return "This course is live. Hiding or showing a section or lesson changes what learners see straight away.";
    case "REVIEW":
      return "This course is in review. You can show or hide sections and lessons after the review.";
    case "DRAFT":
      return "Hidden sections and lessons stay hidden when the course is approved.";
    default:
      return null;
  }
}

/** The unpublish confirmation, so the instructor sees who loses access before deciding. */
export function unpublishWarning(activeEnrollments: number): string {
  const afterwards =
    "The course goes back to draft so you can edit it, and it needs review again before it is live.";
  if (activeEnrollments === 0) {
    return `No learners are enrolled right now. ${afterwards}`;
  }
  const learners =
    activeEnrollments === 1
      ? "1 enrolled learner"
      : `${String(activeEnrollments)} enrolled learners`;
  return `${learners} will lose access until the course is live again. Their enrollments and progress are kept. ${afterwards}`;
}

function successMessage(kind: "Section" | "Lesson", visible: boolean, courseStatus: PublishStatus) {
  if (!visible) return `${kind} hidden from learners`;
  return courseStatus === "PUBLISHED"
    ? `${kind} is visible to learners`
    : `${kind} will be visible once the course is approved`;
}

export async function updateModuleVisibility(args: {
  moduleId: string;
  visible: boolean;
  courseStatus: PublishStatus;
}): Promise<ContentVisibilityResponse["data"]> {
  const response = await clientApi.put<ContentVisibilityResponse>(
    `/api/v1/modules/${args.moduleId}/visibility`,
    { visible: args.visible },
    "module-visibility",
    { successMessage: successMessage("Section", args.visible, args.courseStatus) },
  );
  return response.data;
}

export async function updateLessonVisibility(args: {
  lessonId: string;
  visible: boolean;
  courseStatus: PublishStatus;
}): Promise<ContentVisibilityResponse["data"]> {
  const response = await clientApi.put<ContentVisibilityResponse>(
    `/api/v1/lessons/${args.lessonId}/visibility`,
    { visible: args.visible },
    "lesson-visibility",
    { successMessage: successMessage("Lesson", args.visible, args.courseStatus) },
  );
  return response.data;
}
