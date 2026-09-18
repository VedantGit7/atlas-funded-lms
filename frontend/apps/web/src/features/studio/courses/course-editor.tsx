"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import type {
  studioCourseDetailSchema,
  studioModuleOutlineItemSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseChaptersSidebar } from "./course-chapters-sidebar";
import { CourseEditorWorkspace, type CourseEditorWorkspaceState } from "./course-editor-workspace";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type CourseEditorProps = {
  initialCourse: CourseDetail;
  initialModules: ModuleItem[];
};

export function CourseEditor({ initialCourse, initialModules }: CourseEditorProps) {
  const [modules, setModules] = useState(initialModules);
  const [workspace, setWorkspace] = useState<CourseEditorWorkspaceState>({ mode: "empty" });
  const [lessonsRefreshModuleId, setLessonsRefreshModuleId] = useState<string | null>(null);
  const editable = initialCourse.status === "DRAFT";

  const handleStartAddLesson = useCallback((moduleId: string, moduleTitle: string) => {
    setWorkspace({ mode: "add-lesson", moduleId, moduleTitle });
  }, []);

  const handleCancelAddLesson = useCallback(() => {
    setWorkspace({ mode: "empty" });
  }, []);

  const handleLessonCreated = useCallback((moduleId: string, lessonId: string) => {
    setLessonsRefreshModuleId(moduleId);
    setWorkspace({ mode: "edit-lesson", lessonId, moduleId });
  }, []);

  const handleSelectLesson = useCallback((moduleId: string, lessonId: string) => {
    setWorkspace({ mode: "edit-lesson", lessonId, moduleId });
  }, []);

  const handleLessonDeleted = useCallback(
    (moduleId: string, lessonId: string) => {
      setLessonsRefreshModuleId(moduleId);
      if (workspace.mode === "edit-lesson" && workspace.lessonId === lessonId) {
        setWorkspace({ mode: "empty" });
      }
    },
    [workspace],
  );

  const selectedLessonId = workspace.mode === "edit-lesson" ? workspace.lessonId : null;
  const addingLessonModuleId = workspace.mode === "add-lesson" ? workspace.moduleId : null;

  return (
    <div className="flex min-h-[min(32rem,calc(100vh-10rem))] flex-1 flex-col overflow-hidden lg:min-h-[calc(100vh-10rem)] lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--admin-bg)]">
        <CourseEditorWorkspace
          courseId={initialCourse.id}
          workspace={workspace}
          onCancelAddLesson={handleCancelAddLesson}
          onLessonCreated={handleLessonCreated}
          onLessonDeleted={handleLessonDeleted}
        />
      </section>

      <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-[min(100%,340px)] lg:border-l lg:border-t-0 xl:w-[320px]">
        <CourseChaptersSidebar
          courseId={initialCourse.id}
          modules={modules}
          editable={editable}
          selectedLessonId={selectedLessonId}
          addingLessonModuleId={addingLessonModuleId}
          lessonsRefreshModuleId={lessonsRefreshModuleId}
          onLessonsRefreshed={() => {
            setLessonsRefreshModuleId(null);
          }}
          onChanged={setModules}
          onStartAddLesson={handleStartAddLesson}
          onSelectLesson={handleSelectLesson}
          onLessonDeleted={handleLessonDeleted}
        />
      </aside>
    </div>
  );
}
