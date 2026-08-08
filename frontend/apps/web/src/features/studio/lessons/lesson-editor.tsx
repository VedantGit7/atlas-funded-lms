"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Lock, Trash2 } from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { CourseStatusBadge } from "../courses/course-status-badge";
import { primaryButtonClassName, statusBannerClassName } from "../courses/course-builder-shared";
import { DeleteLessonDialog } from "./delete-lesson-dialog";
import { LessonAssetPanel } from "./lesson-asset-panel";
import { LessonContentEditor } from "./lesson-content-editor";
import {
  formatDurationMmSs,
  lessonDangerIconButtonClassName,
  parseDurationMmSs,
} from "./lesson-editor-shared";
import { LessonSettingsCard } from "./lesson-settings-card";
import { LessonVideoCard } from "./lesson-video-card";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonEditorProps = {
  courseId: string;
  courseTitle: string;
  initialLesson: StudioLessonDetail;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function LockedBanner({ status }: { status: StudioLessonDetail["status"] }) {
  const label =
    status === "REVIEW"
      ? "This lesson is locked while the course is in review. Edits are disabled."
      : status === "PUBLISHED"
        ? "This lesson is locked while the course is published. Edits are disabled."
        : "This lesson is locked. Edits are disabled.";

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-2.5 md:px-8"
    >
      <Lock className="h-[18px] w-[18px] shrink-0 text-[var(--admin-warning)]" aria-hidden="true" />
      <p className="text-sm font-medium text-[var(--admin-warning)]">{label}</p>
    </div>
  );
}

export function LessonEditor({ courseId, courseTitle, initialLesson }: LessonEditorProps) {
  const router = useRouter();
  const [lesson, setLesson] = useState(initialLesson);
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [videoProvider, setVideoProvider] = useState<"" | "youtube" | "vimeo" | "bunny">(
    lesson.videoProvider ?? "",
  );
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [durationMmSs, setDurationMmSs] = useState(formatDurationMmSs(lesson.durationSeconds));
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

  async function handleSave() {
    if (!editable || saving || !title.trim()) return;
    setSaving(true);
    setError(null);

    const durationSeconds = parseDurationMmSs(durationMmSs);

    const trimmedVideoUrl = videoUrl.trim();

    try {
      const response = await clientApi.put<{ data: StudioLessonDetail }>(
        `/api/v1/lessons/${lesson.id}`,
        {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(content.trim() ? { content } : {}),
          ...(videoProvider && trimmedVideoUrl
            ? { videoProvider, videoUrl: trimmedVideoUrl }
            : {}),
          ...(durationSeconds != null ? { durationSeconds } : {}),
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
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-4rem)] flex-col md:-mx-8 md:-my-8">
      {!editable ? <LockedBanner status={lesson.status} /> : null}

      <header className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
            >
              <Link href="/studio" className="transition-colors hover:text-[var(--admin-primary)]">
                Studio
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link href="/studio/courses" className="transition-colors hover:text-[var(--admin-primary)]">
                Courses
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link
                href={`/studio/courses/${courseId}`}
                title="Course builder"
                className="max-w-[12rem] truncate transition-colors hover:text-[var(--admin-primary)]"
              >
                {courseTitle}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-[var(--admin-on-surface)]">Lesson Editor</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-semibold text-[var(--admin-on-surface)] md:text-2xl">
                {title || lesson.title}
              </h1>
              <CourseStatusBadge status={lesson.status} />
            </div>
          </div>

          {editable ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving || !title.trim()}
                onClick={() => {
                  void handleSave();
                }}
                className={primaryButtonClassName}
              >
                {saving ? "Saving…" : "Save lesson"}
              </button>
              <button
                type="button"
                aria-label="Delete lesson"
                onClick={() => {
                  setShowDelete(true);
                }}
                className={lessonDangerIconButtonClassName}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className={`${statusBannerClassName} mx-4 mt-4 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)] md:mx-8`}
        >
          {error}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
        <aside className="flex w-full shrink-0 flex-col gap-4 md:w-[340px]">
          <LessonSettingsCard
            title={title}
            description={description}
            durationMmSs={durationMmSs}
            editable={editable}
            saving={saving}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onDurationChange={setDurationMmSs}
          />
          <LessonVideoCard
            videoProvider={videoProvider}
            videoUrl={videoUrl}
            editable={editable}
            saving={saving}
            onProviderChange={(provider) => {
              setVideoProvider(provider);
              if (!provider) {
                setVideoUrl("");
              }
            }}
            onVideoUrlChange={setVideoUrl}
          />
          <LessonAssetPanel lessonId={lesson.id} editable={editable} />
        </aside>

        <LessonContentEditor
          lesson={{
            ...lesson,
            title,
            description,
            videoProvider: videoProvider || null,
            videoUrl: videoUrl || null,
          }}
          value={content}
          editable={editable}
          saving={saving}
          onChange={setContent}
        />
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
