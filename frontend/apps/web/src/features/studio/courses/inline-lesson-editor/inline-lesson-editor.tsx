"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { inlineExpandClassName } from "../admin-form-dropdown-shared";
import {
  LessonVideoEmbed,
  canEmbedLessonVideo,
  inferVideoProviderFromUrl,
} from "../../../lessons/lesson-video-embed";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
} from "./inline-lesson-editor-shared";
import { InlineLessonEditorHeader } from "./inline-lesson-editor-header";
import { LessonArticleWorkspace } from "./lesson-article-workspace";
import { LessonAttachmentsSidebar } from "./lesson-attachments-sidebar";
import { LessonLiveWorkspace } from "./lesson-live-workspace";
import { LessonSectionQuizWorkspace } from "./lesson-section-quiz-workspace";
import { LessonUploadWorkspace } from "./lesson-upload-workspace";
import { InlineLessonSettingsPanel } from "./inline-lesson-settings-panel";
import { LessonPreviewPanel } from "../../lessons/lesson-preview-panel";
import {
  normalizeLessonTypeForEditor,
  type InlineLessonEditorType,
} from "./lesson-type-meta";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type InlineLessonEditorProps = {
  courseId: string;
  lessonId: string;
  onDeleted: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to load lesson.";
}

function isUploadType(
  lessonType: InlineLessonEditorType | "unsupported",
): lessonType is Extract<InlineLessonEditorType, "video" | "audio" | "pdf" | "slides"> {
  return lessonType === "video" || lessonType === "audio" || lessonType === "pdf" || lessonType === "slides";
}

export function InlineLessonEditor({ courseId, lessonId, onDeleted }: InlineLessonEditorProps) {
  const [lesson, setLesson] = useState<StudioLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [viewMode, setViewMode] = useState<"editor" | "settings">("editor");
  const [showPreview, setShowPreview] = useState(false);

  const loadLesson = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<{ data: StudioLessonDetail }>(
        `/api/v1/lessons/${lessonId}?view=studio`,
      );
      setLesson(response.data);
      setEmbedUrl(response.data.videoUrl ?? "");
    } catch (loadError) {
      setError(formatError(loadError));
      setLesson(null);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void loadLesson();
    setViewMode("editor");
    setShowEmbed(false);
  }, [loadLesson, lessonId]);

  async function saveEmbedUrl() {
    if (!lesson || !embedUrl.trim()) return;

    const provider = inferVideoProviderFromUrl(embedUrl);
    if (!provider) {
      setError("Enter a valid YouTube, Vimeo, or Bunny video URL.");
      return;
    }

    if (!canEmbedLessonVideo(provider, embedUrl)) {
      setError("This video URL cannot be embedded. Check the link and try again.");
      return;
    }

    try {
      await clientApi.put(
        `/api/v1/lessons/${lesson.id}`,
        { videoProvider: provider, videoUrl: embedUrl.trim() },
        "lesson-embed-save",
      );
      setShowEmbed(false);
      setError(null);
      await loadLesson();
    } catch (saveError) {
      setError(formatError(saveError));
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading lesson…</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error ?? "Lesson not found."}
        </p>
        <button
          type="button"
          className="text-sm font-semibold text-[var(--admin-primary)]"
          onClick={() => {
            void loadLesson();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const editorType = normalizeLessonTypeForEditor(lesson.lessonType);
  const editable = lesson.status === "DRAFT";
  const showAttachments = editorType !== "section_quiz";
  const embedDraftProvider = embedUrl.trim() ? inferVideoProviderFromUrl(embedUrl) : null;
  const embedDraftReady = Boolean(
    embedDraftProvider && canEmbedLessonVideo(embedDraftProvider, embedUrl),
  );
  const previewContent =
    typeof lesson.content === "string"
      ? lesson.content
      : lesson.content && typeof lesson.content === "object" && !Array.isArray(lesson.content)
        ? typeof (lesson.content as Record<string, unknown>)["body"] === "string"
          ? ((lesson.content as Record<string, unknown>)["body"] as string)
          : JSON.stringify(lesson.content, null, 2)
        : "";

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      {viewMode === "editor" ? (
        <InlineLessonEditorHeader
          courseId={courseId}
          lessonId={lesson.id}
          title={lesson.title}
          lessonType={lesson.lessonType}
          editable={editable}
          showPreview={editorType !== "section_quiz"}
          onDeleted={onDeleted}
          onOpenSettings={() => {
            setShowEmbed(false);
            setViewMode("settings");
          }}
          onOpenPreview={() => {
            setShowPreview(true);
          }}
        />
      ) : null}

      {showPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Lesson preview"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Lesson preview</h2>
              <button
                type="button"
                className={inlineLessonGhostButtonClassName}
                onClick={() => {
                  setShowPreview(false);
                }}
              >
                Close
              </button>
            </div>
            <LessonPreviewPanel lesson={lesson} content={previewContent} />
          </div>
        </div>
      ) : null}

      {viewMode === "settings" ? (
        <InlineLessonSettingsPanel
          lesson={lesson}
          editable={editable}
          onBack={() => {
            setViewMode("editor");
          }}
          onSaved={(savedLesson) => {
            setLesson(savedLesson);
            setEmbedUrl(savedLesson.videoUrl ?? "");
          }}
        />
      ) : (
        <>
      {error ? (
        <p
          role="alert"
          className="border-b border-[var(--admin-danger)]/25 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-2.5 text-sm text-[var(--admin-danger)] md:px-6"
        >
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
        <div
          className={[
            "mx-auto grid w-full max-w-6xl flex-1 gap-4",
            showAttachments ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "",
          ].join(" ")}
        >
          <div className="min-w-0">
            {isUploadType(editorType) ? (
              <>
                <LessonUploadWorkspace
                  lessonType={editorType}
                  lessonId={lesson.id}
                  lessonTitle={lesson.title}
                  videoProvider={lesson.videoProvider ?? null}
                  videoUrl={lesson.videoUrl ?? null}
                  editable={editable}
                  onEmbedVideo={() => {
                    setError(null);
                    setShowEmbed(true);
                  }}
                  onFileUploaded={() => {
                    void loadLesson();
                  }}
                />
                {showEmbed ? (
                  <div className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
                    <label className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]">
                      Embed video URL
                    </label>
                    <input
                      className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={embedUrl}
                      onChange={(event) => {
                        setEmbedUrl(event.target.value);
                        setError(null);
                      }}
                    />
                    {embedDraftReady && embedDraftProvider ? (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                          Preview
                        </p>
                        <LessonVideoEmbed
                          provider={embedDraftProvider}
                          url={embedUrl.trim()}
                          title={lesson.title}
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className={inlineLessonPrimaryDarkButtonClassName}
                        onClick={() => {
                          void saveEmbedUrl();
                        }}
                      >
                        Save embed
                      </button>
                      <button
                        type="button"
                        className={inlineLessonGhostButtonClassName}
                        onClick={() => {
                          setShowEmbed(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {editorType === "live" ? (
              <LessonLiveWorkspace
                lesson={lesson}
                editable={editable}
                onSaved={() => {
                  void loadLesson();
                }}
              />
            ) : null}
            {editorType === "article" ? (
              <LessonArticleWorkspace lesson={lesson} editable={editable} />
            ) : null}
            {editorType === "section_quiz" ? (
              <LessonSectionQuizWorkspace lesson={lesson} editable={editable} />
            ) : null}

            {editorType === "unsupported" ? (
              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  This lesson type does not have an inline editor yet. Open the full lesson editor
                  to continue.
                </p>
              </section>
            ) : null}
          </div>

          {showAttachments ? (
            <LessonAttachmentsSidebar lessonId={lesson.id} editable={editable} />
          ) : null}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
