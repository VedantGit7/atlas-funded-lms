import type { z } from "zod";
import { CourseDashboard } from "../../../../../features/studio/courses/course-dashboard";
import { serverApi } from "../../../../../lib/server-api";
import type {
  studioCourseDetailResponseSchema,
  studioCourseModulesResponseSchema,
} from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;
type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;

type StudioCourseDashboardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseDashboardRoute({
  params,
}: StudioCourseDashboardPageProps) {
  const { id } = await params;

  const [course, modules] = await Promise.all([
    serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`),
    serverApi.get<StudioCourseModulesResponse>(`/api/v1/courses/${id}/modules?view=studio`),
  ]);

  return <CourseDashboard course={course.data} modules={modules.data.items} />;
}
