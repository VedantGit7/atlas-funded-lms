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
  searchParams: Promise<{ lesson?: string | string[]; module?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function single(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text && UUID.test(text) ? text : null;
}

export default async function StudioCourseEditorPage({
  params,
  searchParams,
}: StudioCourseEditorPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const lessonId = single(query.lesson);
  const moduleId = single(query.module);

  const [course, modules] = await Promise.all([
    serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`),
    serverApi.get<StudioCourseModulesResponse>(`/api/v1/courses/${id}/modules?view=studio`),
  ]);

  return (
    <CourseEditorLazy
      initialCourse={course.data}
      initialModules={modules.data.items}
      initialLesson={lessonId && moduleId ? { lessonId, moduleId } : null}
    />
  );
}
