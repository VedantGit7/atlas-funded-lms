import { redirect } from "next/navigation";
import type { z } from "zod";
import { PageGate } from "../../../../../../components/patterns/PageGate";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";
import type { studioLessonDetailResponseSchema } from "@atlas/contracts/lessons/lesson-schemas";

type StudioLessonDetailResponse = z.infer<typeof studioLessonDetailResponseSchema>;

type StudioLessonPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

/**
 * Lessons are edited in one place: the course builder. This address used to
 * open a second, separate lesson editor (QA review 1 C18); links to it now open
 * the builder with the lesson selected.
 */
export default async function StudioLessonPage({ params }: StudioLessonPageProps) {
  const { id: courseId, lessonId } = await params;

  let moduleId: string;
  try {
    const lesson = await serverApi.get<StudioLessonDetailResponse>(
      `/api/v1/lessons/${encodeURIComponent(lessonId)}?view=studio`,
    );
    if (lesson.data.courseId !== courseId) {
      return (
        <PageGate
          state="not_found"
          title="Lesson"
          notFoundMessage="Lesson not found or access denied."
        />
      );
    }
    moduleId = lesson.data.moduleId;
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Lesson"
          notFoundMessage="Lesson not found or access denied."
        />
      );
    }
    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Lesson"
          errorMessage={`Failed to load lesson. Request ID: ${error.requestId}`}
        />
      );
    }
    throw error;
  }

  const query = new URLSearchParams({ lesson: lessonId, module: moduleId });
  redirect(`/studio/courses/${encodeURIComponent(courseId)}/editor?${query.toString()}`);
}
