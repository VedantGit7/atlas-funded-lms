import type { z } from "zod";
import { CourseOverview } from "../../../../features/studio/courses/course-overview";
import { serverApi } from "../../../../lib/server-api";
import type {
  studioCourseDetailResponseSchema,
  studioCourseModulesResponseSchema,
} from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;
type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;

type StudioCourseOverviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseOverviewPage({ params }: StudioCourseOverviewPageProps) {
  const { id } = await params;

  try {
    const [course, modules] = await Promise.all([
      serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`),
      serverApi.get<StudioCourseModulesResponse>(`/api/v1/courses/${id}/modules?view=studio`),
    ]);

    return <CourseOverview course={course.data} modules={modules.data.items} courseId={id} />;
  } catch (error) {
    throw error;
  }
}
