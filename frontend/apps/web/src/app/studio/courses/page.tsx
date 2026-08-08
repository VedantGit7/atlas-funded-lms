import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import { CourseManager } from "../../../features/studio/courses/course-manager";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { studioCourseListResponseSchema } from "@atlas/contracts/courses/schemas";

type StudioCourseListResponse = z.infer<typeof studioCourseListResponseSchema>;

export default async function StudioCoursesPage() {
  try {
    const courses = await serverApi.get<StudioCourseListResponse>(
      "/api/v1/courses?view=studio&limit=100",
    );

    return (
      <PageGate state="ready" title="Courses">
        <CourseManager courses={courses.data.items} canCreate />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 401 || error.status === 403) {
        return (
          <PageGate
            state="denied"
            title="Courses"
            deniedMessage="You do not have permission to manage courses."
          />
        );
      }
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Courses"
          errorMessage={`Failed to load courses. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
