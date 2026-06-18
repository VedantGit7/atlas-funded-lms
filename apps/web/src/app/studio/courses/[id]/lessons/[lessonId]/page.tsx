import type { z } from "zod";
import { PageGate } from "../../../../../../components/patterns/PageGate";
import { LessonEditor } from "../../../../../../features/studio/lessons/lesson-editor";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";
import type { studioLessonDetailResponseSchema } from "../../../../../../server/lessons/lesson-schemas";

type StudioLessonDetailResponse = z.infer<typeof studioLessonDetailResponseSchema>;

type StudioLessonEditorPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function StudioLessonEditorPage({ params }: StudioLessonEditorPageProps) {
  const { id: courseId, lessonId } = await params;

  try {
    const lesson = await serverApi.get<StudioLessonDetailResponse>(
      `/api/v1/lessons/${lessonId}?view=studio`,
    );

    return (
      <PageGate state="ready" title="Lesson editor">
        <LessonEditor courseId={courseId} initialLesson={lesson.data} />
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
