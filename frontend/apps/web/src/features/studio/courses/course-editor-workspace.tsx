"use client";

import { BookOpen } from "lucide-react";
import { AddLessonPanel } from "./add-lesson-panel";
import { InlineLessonEditor } from "./inline-lesson-editor/inline-lesson-editor";

export type CourseEditorWorkspaceState =
  | { mode: "empty" }
  | { mode: "add-lesson"; moduleId: string; moduleTitle: string }
  | { mode: "edit-lesson"; lessonId: string; moduleId: string };

type CourseEditorWorkspaceProps = {
  courseId: string;
  workspace: CourseEditorWorkspaceState;
  onCancelAddLesson: () => void;
  onLessonCreated: (moduleId: string, lessonId: string) => void;
  onLessonDeleted: (moduleId: string, lessonId: string) => void;
};

export function CourseEditorWorkspace({
  courseId,
  workspace,
  onCancelAddLesson,
  onLessonCreated,
  onLessonDeleted,
}: CourseEditorWorkspaceProps) {
  if (workspace.mode === "add-lesson") {
    return (
      <AddLessonPanel
        moduleId={workspace.moduleId}
        moduleTitle={workspace.moduleTitle}
        onCancel={onCancelAddLesson}
        onLessonCreated={onLessonCreated}
      />
    );
  }

  if (workspace.mode === "edit-lesson") {
    return (
      <InlineLessonEditor
        courseId={courseId}
        lessonId={workspace.lessonId}
        onDeleted={() => {
          onLessonDeleted(workspace.moduleId, workspace.lessonId);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-[min(28rem,calc(100vh-12rem))] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        <BookOpen className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm font-medium text-[var(--admin-on-surface-variant)]">
        Select a lesson on the right to start editing, or add a new lesson to a chapter.
      </p>
    </div>
  );
}
