import type { z } from "zod";
import type {
  createTagBodySchema,
  courseTagsResponseSchema,
  lessonTagsResponseSchema,
  tagDetailSchema,
  tagListResponseSchema,
} from "@atlas/contracts/tags/tag-schemas";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

export type StudioTagScope = "lesson" | "course";

type CreateTagBody = z.infer<typeof createTagBodySchema>;
type LessonTagsResponse = z.infer<typeof lessonTagsResponseSchema>;
type CourseTagsResponse = z.infer<typeof courseTagsResponseSchema>;
type TagDetail = z.infer<typeof tagDetailSchema>;
type CreateLessonTagResponse = {
  data: { tag: TagDetail; lessonTags: LessonTagsResponse["data"] };
};
type CreateCourseTagResponse = {
  data: { tag: TagDetail; courseTags: CourseTagsResponse["data"] };
};
type TagListResponse = z.infer<typeof tagListResponseSchema>;
type TagItems = LessonTagsResponse["data"]["items"];

function tagsPath(scope: StudioTagScope, entityId: string): string {
  const resource = scope === "lesson" ? "lessons" : "courses";
  return `/api/v1/${resource}/${entityId}/tags`;
}

export function formatTagError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Tag request failed.";
}

export async function fetchEntityTags(scope: StudioTagScope, entityId: string): Promise<TagItems> {
  const response = await clientApi.get<LessonTagsResponse | CourseTagsResponse>(
    `${tagsPath(scope, entityId)}?view=studio`,
  );
  return response.data.items;
}

export async function createEntityTag(
  scope: StudioTagScope,
  entityId: string,
  body: CreateTagBody,
): Promise<{ tag: CreateLessonTagResponse["data"]["tag"]; attachedTags: TagItems }> {
  if (scope === "lesson") {
    const response = await clientApi.post<CreateLessonTagResponse>(
      tagsPath(scope, entityId),
      body,
      "lesson-tag-create",
    );
    return {
      tag: response.data.tag,
      attachedTags: response.data.lessonTags.items,
    };
  }

  const response = await clientApi.post<CreateCourseTagResponse>(
    tagsPath(scope, entityId),
    body,
    "course-tag-create",
  );
  return {
    tag: response.data.tag,
    attachedTags: response.data.courseTags.items,
  };
}

export async function detachEntityTag(
  scope: StudioTagScope,
  entityId: string,
  tagId: string,
): Promise<TagItems> {
  const response = await clientApi.delete<LessonTagsResponse | CourseTagsResponse>(
    `${tagsPath(scope, entityId)}?tagId=${encodeURIComponent(tagId)}`,
    scope === "lesson" ? "lesson-tag-detach" : "course-tag-detach",
  );
  return response.data.items;
}

export async function fetchTenantTags(): Promise<TagListResponse["data"]["items"]> {
  const response = await clientApi.get<TagListResponse>("/api/v1/tags");
  return response.data.items;
}

export async function attachExistingEntityTags(
  scope: StudioTagScope,
  entityId: string,
  tagIds: string[],
): Promise<TagItems> {
  const response = await clientApi.put<LessonTagsResponse | CourseTagsResponse>(
    tagsPath(scope, entityId),
    { tagIds },
    scope === "lesson" ? "lesson-tags-replace" : "course-tags-replace",
  );
  return response.data.items;
}

export async function attachTagToEntity(
  scope: StudioTagScope,
  entityId: string,
  tagId: string,
  currentTagIds: string[],
): Promise<TagItems> {
  if (currentTagIds.includes(tagId)) {
    return fetchEntityTags(scope, entityId);
  }
  return attachExistingEntityTags(scope, entityId, [...currentTagIds, tagId]);
}

// Lesson-specific aliases kept for existing call sites.
export const fetchLessonTags = (lessonId: string) => fetchEntityTags("lesson", lessonId);
export const createLessonTag = (lessonId: string, body: CreateTagBody) =>
  createEntityTag("lesson", lessonId, body).then((result) => ({
    tag: result.tag,
    lessonTags: { items: result.attachedTags },
  }));
export const detachLessonTag = (lessonId: string, tagId: string) =>
  detachEntityTag("lesson", lessonId, tagId);
export const attachExistingTags = (lessonId: string, tagIds: string[]) =>
  attachExistingEntityTags("lesson", lessonId, tagIds);
export const attachTagToLesson = (lessonId: string, tagId: string, currentTagIds: string[]) =>
  attachTagToEntity("lesson", lessonId, tagId, currentTagIds);
