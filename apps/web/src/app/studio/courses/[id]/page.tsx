import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { CourseBuilder } from "../../../../features/studio/courses/course-builder";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type {
  studioCourseDetailResponseSchema,
  studioCourseModulesResponseSchema,
} from "../../../../server/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;
type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;

type StudioCourseBuilderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseBuilderPage({ params }: StudioCourseBuilderPageProps) {
  const { id } = await params;

  try {
    const [course, modules] = await Promise.all([
      serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`),
      serverApi.get<StudioCourseModulesResponse>(`/api/v1/courses/${id}/modules?view=studio`),
    ]);

    return (
      <PageGate state="ready" title="Course builder">
        <main>
          <CourseBuilder
            initialCourse={course.data}
            initialModules={modules.data.items}
            canPublish
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Course builder"
          notFoundMessage="Course not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Course builder"
          errorMessage={`Failed to load course. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
