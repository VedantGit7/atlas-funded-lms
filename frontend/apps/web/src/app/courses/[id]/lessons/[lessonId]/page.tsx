import type { z } from "zod";
import { PageGate } from "../../../../../components/patterns/PageGate";
import {
  COURSE_BEING_UPDATED,
  CourseBeingUpdated,
} from "../../../../../features/courses/course-being-updated";
import { LessonPlayerShell } from "../../../../../features/lessons/lesson-player-shell";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import type { courseDetailResponseSchema } from "@atlas/contracts/courses/schemas";
import type { learnerLessonDetailResponseSchema } from "@atlas/contracts/lessons/lesson-schemas";
import type { learnerCourseOutlineResponseSchema } from "@atlas/contracts/courses/course-outline.schemas";
import { courseOutlinePath } from "../../../../../features/lessons/course-outline-model";

type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
type LearnerLessonDetailResponse = z.infer<typeof learnerLessonDetailResponseSchema>;
type LearnerCourseOutlineResponse = z.infer<typeof learnerCourseOutlineResponseSchema>;

type LessonPlayerPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function LessonPlayerPage({ params }: LessonPlayerPageProps) {
  const { id: courseId, lessonId } = await params;

  try {
    const [course, lesson, outline] = await Promise.all([
      serverApi.get<CourseDetailResponse>(`/api/v1/courses/${courseId}`),
      serverApi.get<LearnerLessonDetailResponse>(`/api/v1/lessons/${lessonId}`),
      // The outline beside the lesson is a convenience: without it the lesson
      // still opens, with Previous and Next.
      serverApi
        .get<LearnerCourseOutlineResponse>(courseOutlinePath(courseId))
        .then((response) => response.data)
        .catch(() => null),
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
        <LessonPlayerShell
          key={lesson.data.id}
          courseTitle={course.data.title}
          lesson={lesson.data}
          outline={outline}
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === COURSE_BEING_UPDATED) {
        return <CourseBeingUpdated />;
      }

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
