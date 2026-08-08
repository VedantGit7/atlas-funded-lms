import type { z } from "zod";
import { PageGate } from "../../../../../../components/patterns/PageGate";
import { LessonEditorLazy } from "../../../../../../features/studio/lessons/lesson-editor-lazy";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";
import type { studioCourseDetailResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonDetailResponseSchema } from "@atlas/contracts/lessons/lesson-schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;
type StudioLessonDetailResponse = z.infer<typeof studioLessonDetailResponseSchema>;

type StudioLessonEditorPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function StudioLessonEditorPage({ params }: StudioLessonEditorPageProps) {
  const { id: courseId, lessonId } = await params;

  try {
    const [course, lesson] = await Promise.all([
      serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${courseId}?view=studio`),
      serverApi.get<StudioLessonDetailResponse>(`/api/v1/lessons/${lessonId}?view=studio`),
    ]);

    return (
      <PageGate state="ready" title="Lesson editor">
        <LessonEditorLazy
          courseId={courseId}
          courseTitle={course.data.title}
          initialLesson={lesson.data}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Lesson editor"
          notFoundMessage="Lesson not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Lesson editor"
          errorMessage={`Failed to load lesson. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
