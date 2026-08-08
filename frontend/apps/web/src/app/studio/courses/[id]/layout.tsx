import { headers } from "next/headers";
import type { z } from "zod";
import { PageGate } from "../../../../components/patterns/PageGate";
import { CourseDetailShell } from "../../../../features/studio/courses/course-detail-shell";
import { isStandaloneStudioCourseRoute } from "../../../../features/studio/courses/course-detail-shared";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { studioCourseDetailResponseSchema } from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;

type StudioCourseIdLayoutProps = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export default async function StudioCourseIdLayout({
  params,
  children,
}: StudioCourseIdLayoutProps) {
  const { id } = await params;
  const pathname = (await headers()).get("x-atlas-pathname") ?? "";

  if (isStandaloneStudioCourseRoute(pathname, id)) {
    return <>{children}</>;
  }

  try {
    const course = await serverApi.get<StudioCourseDetailResponse>(
      `/api/v1/courses/${id}?view=studio`,
    );

    return (
      <PageGate state="ready" title={course.data.title}>
        <div className="min-w-0 w-full">
          <CourseDetailShell course={course.data} canPublish>
            {children}
          </CourseDetailShell>
        </div>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Course"
          notFoundMessage="Course not found or access denied."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Course"
          errorMessage={`Failed to load course. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
