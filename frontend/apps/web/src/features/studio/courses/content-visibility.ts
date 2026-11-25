import type { z } from "zod";
import type {
  contentVisibilityResponseSchema,
  publishStatusStudioSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { clientApi } from "../../../lib/client-api";

/**
 * Editing, publishing and hiding sections and lessons (QA S1.6).
 *
 * - Content can be added and edited while the course is a draft or live, not
 *   while it's in review or archived.
 * - In a live course, new sections and lessons start as drafts learners can't
 *   see, and are published one by one; publishing a section publishes its
 *   draft lessons too. Edits to published lessons reach learners on save.
 * - Each section and lesson has one visibility control. Hidden content is
 *   stored as ARCHIVED: learners never see it, and approving the course leaves
 *   it hidden. In a draft course everything else goes live on approval.
 */

type PublishStatus = z.infer<typeof publishStatusStudioSchema>;
type ContentVisibilityResponse = z.infer<typeof contentVisibilityResponseSchema>;
type ContentKind = "Section" | "Lesson";

export function isContentHidden(status: PublishStatus): boolean {
  return status === "ARCHIVED";
}

/** Adding, editing, moving and trashing sections and lessons. */
export function canEditCourseContent(courseStatus: PublishStatus): boolean {
  return courseStatus === "DRAFT" || courseStatus === "PUBLISHED";
}

export function canChangeContentVisibility(courseStatus: PublishStatus): boolean {
  return canEditCourseContent(courseStatus);
}

/** A section or lesson added to a live course that learners can't see yet. */
export function isUnpublishedInLiveCourse(
  status: PublishStatus,
  courseStatus: PublishStatus,
): boolean {
  return courseStatus === "PUBLISHED" && (status === "DRAFT" || status === "REVIEW");
}

/** The one visibility action a section or lesson offers right now. */
export function contentVisibilityAction(args: {
  kind: ContentKind;
  status: PublishStatus;
  courseStatus: PublishStatus;
}): { label: string; visible: boolean } {
  if (isUnpublishedInLiveCourse(args.status, args.courseStatus)) {
    return { label: `Publish ${args.kind.toLowerCase()}`, visible: true };
  }
  if (isContentHidden(args.status)) return { label: "Show to learners", visible: true };
  return { label: "Hide", visible: false };
}

/** One line for the chapters panel explaining what changes do right now. */
export function contentVisibilityNotice(courseStatus: PublishStatus): string | null {
  switch (courseStatus) {
    case "PUBLISHED":
      return "This course is live. New sections and lessons stay as drafts until you publish them, and changes to published lessons reach learners when you save.";
    case "REVIEW":
      return "This course is in review. You can edit, show or hide its content after the review.";
    case "DRAFT":
      return "Everything here goes live when the course is approved, except hidden sections and lessons.";
    default:
      return null;
  }
}

/** The unpublish confirmation, so the instructor sees who loses access before deciding. */
export function unpublishWarning(activeEnrollments: number): string {
  const afterwards =
    "The course goes back to draft so you can edit it, and it needs review again before it is live. To add or change lessons without taking it offline, use the course editor instead.";
  if (activeEnrollments === 0) {
    return `No learners are enrolled right now. ${afterwards}`;
  }
  const learners =
    activeEnrollments === 1
      ? "1 enrolled learner"
      : `${String(activeEnrollments)} enrolled learners`;
  return `${learners} will lose access until the course is live again: they'll see that it's being updated. Their enrollments and progress are kept. ${afterwards}`;
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

/** Said after a visibility change; built from the result so it matches what happened. */
export function visibilityResultMessage(args: {
  kind: ContentKind;
  before: PublishStatus;
  result: ContentVisibilityResponse["data"];
  courseStatus: PublishStatus;
}): string {
  const { kind, before, result, courseStatus } = args;
  if (!result.visible) return `${kind} hidden from learners`;
  if (courseStatus !== "PUBLISHED") return `${kind} will be visible once the course is approved`;
  const withLessons =
    kind === "Section" && (result.lessonsPublished ?? 0) > 0
      ? `, with ${plural(result.lessonsPublished ?? 0, "lesson")}`
      : "";
  return isUnpublishedInLiveCourse(before, courseStatus)
    ? `${kind} published${withLessons}. Learners can see it now.`
    : `${kind} is visible to learners${withLessons}`;
}

export async function updateModuleVisibility(args: {
  moduleId: string;
  visible: boolean;
}): Promise<ContentVisibilityResponse["data"]> {
  const response = await clientApi.put<ContentVisibilityResponse>(
    `/api/v1/modules/${args.moduleId}/visibility`,
    { visible: args.visible },
    "module-visibility",
    { silent: true },
  );
  return response.data;
}

export async function updateLessonVisibility(args: {
  lessonId: string;
  visible: boolean;
}): Promise<ContentVisibilityResponse["data"]> {
  const response = await clientApi.put<ContentVisibilityResponse>(
    `/api/v1/lessons/${args.lessonId}/visibility`,
    { visible: args.visible },
    "lesson-visibility",
    { silent: true },
  );
  return response.data;
}
