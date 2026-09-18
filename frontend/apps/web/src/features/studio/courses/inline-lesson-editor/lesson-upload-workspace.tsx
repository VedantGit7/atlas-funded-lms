"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Code2, Cloud, Info } from "lucide-react";
import { LessonVideoEmbed, canEmbedLessonVideo } from "../../../lessons/lesson-video-embed";
import { inlineLessonSecondaryButtonClassName } from "./inline-lesson-editor-shared";
import { uploadWorkspaceMeta, type InlineLessonEditorType } from "./lesson-type-meta";
import { uploadLessonAssetFile } from "../upload-lesson-asset";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

type LessonUploadWorkspaceProps = {
  lessonType: InlineLessonEditorType;
  lessonId: string;
  lessonTitle?: string;
  videoProvider?: string | null;
  videoUrl?: string | null;
  editable: boolean;
  onEmbedVideo?: () => void;
  onFileUploaded?: () => void;
};

export function LessonUploadWorkspace({
  lessonType,
  lessonId,
  lessonTitle = "Lesson video",
  videoProvider,
  videoUrl,
  editable,
  onEmbedVideo,
  onFileUploaded,
}: LessonUploadWorkspaceProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = uploadWorkspaceMeta(lessonType);

  useEffect(() => {
    setError(null);
  }, [lessonId, lessonType]);

  if (!meta) return null;

  const trimmedVideoUrl = videoUrl?.trim() ?? "";
  const hasVideoEmbed =
    lessonType === "video" &&
    Boolean(
      videoProvider && trimmedVideoUrl && canEmbedLessonVideo(videoProvider, trimmedVideoUrl),
    );

  function openFilePicker() {
    if (!editable || hasVideoEmbed) return;
    fileInputRef.current?.click();
  }

  function handleEmbedClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onEmbedVideo?.();
  }

  function handleCloudClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    openFilePicker();
  }

  async function handleFileSelected(file: File) {
    if (!editable || uploading) return;

    // Video files are not allowed - must use embed
    if (lessonType === "video") {
      setError("Use Embed video for video lessons");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const assetReferenceId = await uploadLessonAssetFile(lessonId, file, "lesson.asset");

      // Save primaryAssetReferenceId to content_json
      await clientApi.put(
        `/api/v1/lessons/${lessonId}`,
        {
          content: {
            primaryAssetReferenceId: assetReferenceId,
            primaryAssetFileName: file.name,
          },
        },
        "lesson-primary-asset-save",
      );

      onFileUploaded?.();
    } catch (uploadError) {
      if (uploadError instanceof ClientApiError) {
        setError(uploadError.message);
      } else {
        setError("File upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex min-h-[min(28rem,calc(100vh-14rem))] flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="flex items-center gap-2 border-b border-[var(--admin-border)] px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">{meta.panelTitle}</h2>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
          aria-label="Upload help"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {error ? (
        <div className="border-b border-[var(--admin-danger)]/25 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-5 py-2 text-sm text-[var(--admin-danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div
          className={[
            "relative flex min-h-[18rem] flex-1 flex-col rounded-xl border-2 border-dashed transition-colors",
            dragActive
              ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface-low))]"
              : hasVideoEmbed
                ? "border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
                : "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface-low))]",
            editable ? "" : "opacity-60",
          ].join(" ")}
          onDragEnter={(event) => {
            event.preventDefault();
            if (editable && !hasVideoEmbed) setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            if (!editable || hasVideoEmbed || uploading) return;
            const file = event.dataTransfer.files[0];
            if (file) void handleFileSelected(file);
          }}
        >
          {hasVideoEmbed && videoProvider ? (
            <div className="flex flex-1 flex-col p-4">
              <LessonVideoEmbed
                provider={videoProvider}
                url={trimmedVideoUrl}
                title={lessonTitle}
                className="aspect-video w-full flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
              />
            </div>
          ) : (
            <button
              type="button"
              className={[
                "flex flex-1 flex-col items-center justify-center px-6 py-12 text-center",
                editable && !uploading ? "cursor-pointer" : "cursor-not-allowed",
              ].join(" ")}
              disabled={!editable || uploading}
              onClick={openFilePicker}
            >
              <p id={inputId} className="text-sm text-[var(--admin-on-surface-variant)]">
                {uploading ? (
                  "Uploading..."
                ) : (
                  <>
                    Drop files here or{" "}
                    <span className="font-semibold text-[var(--admin-primary)]">browse files</span>
                  </>
                )}
              </p>
            </button>
          )}

          {(meta.showCloudStorage || meta.showEmbedVideo) && (
            <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-4">
              {meta.showCloudStorage ? (
                <button
                  type="button"
                  className={inlineLessonSecondaryButtonClassName}
                  disabled={!editable || uploading}
                  onClick={handleCloudClick}
                >
                  <Cloud className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  Cloud Storage
                </button>
              ) : null}
              {meta.showEmbedVideo ? (
                <button
                  type="button"
                  className={inlineLessonSecondaryButtonClassName}
                  disabled={!editable || uploading}
                  onClick={handleEmbedClick}
                >
                  <Code2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {hasVideoEmbed ? "Change embed" : "Embed video"}
                </button>
              ) : null}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={meta.accept}
          className="sr-only"
          disabled={!editable || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFileSelected(file);
            event.target.value = "";
            setDragActive(false);
          }}
        />
      </div>
    </section>
  );
}
