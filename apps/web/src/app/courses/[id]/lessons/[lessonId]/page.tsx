import type { z } from "zod";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { LessonPlayerShell } from "../../../../../features/lessons/lesson-player-shell";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import type { courseDetailResponseSchema } from "../../../../../server/courses/schemas";
import type { learnerLessonDetailResponseSchema } from "../../../../../server/lessons/lesson-schemas";

type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
type LearnerLessonDetailResponse = z.infer<typeof learnerLessonDetailResponseSchema>;

type LessonPlayerPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function LessonPlayerPage({ params }: LessonPlayerPageProps) {
  const { id: courseId, lessonId } = await params;

  try {
    const [course, lesson] = await Promise.all([
      serverApi.get<CourseDetailResponse>(`/api/v1/courses/${courseId}`),
      serverApi.get<LearnerLessonDetailResponse>(`/api/v1/lessons/${lessonId}`),
    ]);

    if (course.data.enrollmentStatus !== "enrolled") {
      return (
        <PageGate
          state="denied"
          title="Lesson player"
          deniedMessage="Enroll in this course to access lessons."
        />
      );
    }

    return (
      <PageGate state="ready" title={lesson.data.title}>
        <LessonPlayerShell courseTitle={course.data.title} lesson={lesson.data} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 404 || error.status === 403) {
        return (
          <PageGate
            state="not_found"
            title="Lesson player"
            notFoundMessage="Lesson not found or access denied."
          />
        );
      }

      if (error.status === 401) {
        return (
          <PageGate
            state="denied"
            title="Lesson player"
            deniedMessage="Sign in with an active membership to view this lesson."
          />
        );
      }
    }

    throw error;
  }
}
