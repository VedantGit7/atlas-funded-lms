import type { z } from "zod";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { CourseManager } from "../../../features/studio/courses/course-manager";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { studioCourseListResponseSchema } from "../../../server/courses/schemas";

type StudioCourseListResponse = z.infer<typeof studioCourseListResponseSchema>;

export default async function StudioCoursesPage() {
  try {
    const courses = await serverApi.get<StudioCourseListResponse>("/api/v1/courses?view=studio");

    return (
      <PageGate state="ready" title="Course manager">
        <main className="space-y-6">
          <PageHeader
            title="Course manager"
            description="Create and manage courses you author in this tenant."
          />
          <CourseManager courses={courses.data.items} canCreate />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Course manager"
            deniedMessage="You do not have permission to manage courses."
          />
        );
      }
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Course manager"
          errorMessage={`Failed to load courses. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
