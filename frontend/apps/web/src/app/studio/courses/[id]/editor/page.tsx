import type { z } from "zod";
import { CourseEditorLazy } from "../../../../../features/studio/courses/course-editor-lazy";
import { serverApi } from "../../../../../lib/server-api";
import type {
  studioCourseDetailResponseSchema,
  studioCourseModulesResponseSchema,
} from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;
type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;

type StudioCourseEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseEditorPage({ params }: StudioCourseEditorPageProps) {
  const { id } = await params;

  const [course, modules] = await Promise.all([
    serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`),
    serverApi.get<StudioCourseModulesResponse>(`/api/v1/courses/${id}/modules?view=studio`),
  ]);

  return (
    <CourseEditorLazy initialCourse={course.data} initialModules={modules.data.items} />
  );
}
