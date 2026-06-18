"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioLessonDetailSchema } from "../../../server/lessons/lesson-schemas";
import { DeleteLessonDialog } from "./delete-lesson-dialog";
import { LessonAssetPanel } from "./lesson-asset-panel";
import { LessonContentEditor } from "./lesson-content-editor";
import { LessonPreviewPanel } from "./lesson-preview-panel";
import { LessonSettingsForm } from "./lesson-settings-form";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonEditorProps = {
  courseId: string;
  initialLesson: StudioLessonDetail;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function LessonEditor({ courseId, initialLesson }: LessonEditorProps) {
  const router = useRouter();
  const [lesson, setLesson] = useState(initialLesson);
  const [content, setContent] = useState(
    typeof initialLesson.content === "string"
      ? initialLesson.content
      : initialLesson.content != null
        ? JSON.stringify(initialLesson.content, null, 2)
        : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const editable = lesson.status === "DRAFT";

  async function handleSave(settings: {
    title: string;
    description: string;
    videoProvider: string;
    videoUrl: string;
    durationSeconds: string;
  }) {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<{ data: StudioLessonDetail }>(
        `/api/v1/lessons/${lesson.id}?view=studio`,
        {
          title: settings.title,
          description: settings.description || undefined,
          content,
          videoProvider: settings.videoProvider || undefined,
          videoUrl: settings.videoUrl || undefined,
          durationSeconds: settings.durationSeconds ? Number(settings.durationSeconds) : undefined,
        },
        "lesson-save",
      );
      setLesson(response.data);
      router.refresh();
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm opacity-70">
          <Link href="/studio/courses">Studio Courses</Link>
          {" → "}
          <Link href={`/studio/courses/${courseId}`}>Course Builder</Link>
          {" → Lesson Editor"}
        </p>
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        {!editable ? (
          <p role="status" className="text-sm text-amber-700">
            This lesson is locked while the course is in {lesson.status} state.
          </p>
        ) : null}
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <LessonSettingsForm
        lesson={lesson}
        editable={editable}
        saving={saving}
        onSave={(values) => {
          void handleSave(values);
        }}
      />

      <LessonContentEditor value={content} editable={editable} onChange={setContent} />

      <LessonAssetPanel lessonId={lesson.id} editable={editable} />

      <LessonPreviewPanel lesson={lesson} content={content} />

      <div className="flex flex-wrap gap-3">
        {editable ? (
          <button
            type="button"
            onClick={() => {
              setShowDelete(true);
            }}
          >
            Delete lesson
          </button>
        ) : null}
      </div>

      <DeleteLessonDialog
        open={showDelete}
        lessonId={lesson.id}
        courseId={courseId}
        onClose={() => {
          setShowDelete(false);
        }}
      />
    </div>
  );
}
