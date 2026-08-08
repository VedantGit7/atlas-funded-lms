"use client";

import { Film, PlayCircle } from "lucide-react";
import { LessonVideoEmbed, canEmbedLessonVideo } from "../../lessons/lesson-video-embed";
import {
  lessonCardClassName,
  lessonCardTitleClassName,
  lessonFieldLabelClassName,
  lessonInputClassName,
  lessonLockedInputClassName,
} from "./lesson-editor-shared";

type VideoProvider = "" | "youtube" | "vimeo" | "bunny";

const PROVIDER_OPTIONS: {
  id: VideoProvider;
  label: string;
  dotClassName: string;
}[] = [
  { id: "youtube", label: "YouTube", dotClassName: "bg-[var(--admin-danger)]" },
  { id: "vimeo", label: "Vimeo", dotClassName: "bg-[var(--admin-primary)]" },
  { id: "bunny", label: "Bunny", dotClassName: "bg-[var(--admin-primary-strong)]" },
  { id: "", label: "None", dotClassName: "bg-[var(--admin-outline)]" },
];

type LessonVideoCardProps = {
  videoProvider: VideoProvider;
  videoUrl: string;
  editable: boolean;
  saving: boolean;
  onProviderChange: (provider: VideoProvider) => void;
  onVideoUrlChange: (url: string) => void;
};

export function LessonVideoCard({
  videoProvider,
  videoUrl,
  editable,
  saving,
  onProviderChange,
  onVideoUrlChange,
}: LessonVideoCardProps) {
  const disabled = !editable || saving;
  const inputClass = editable ? lessonInputClassName : lessonLockedInputClassName;
  const trimmedVideoUrl = videoUrl.trim();
  const hasVideo = Boolean(videoProvider && trimmedVideoUrl);
  const embedReady = hasVideo && canEmbedLessonVideo(videoProvider, trimmedVideoUrl);

  return (
    <section className={lessonCardClassName}>
      <div className="flex items-center gap-2 text-[var(--admin-on-surface)]">
        <Film className="h-[18px] w-[18px] text-[var(--admin-primary)]" aria-hidden="true" />
        <h2 className={lessonCardTitleClassName}>Video Content</h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className={lessonFieldLabelClassName}>Provider</span>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDER_OPTIONS.map((option) => {
              const active = videoProvider === option.id;
              return (
                <button
                  key={option.id || "none"}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onProviderChange(option.id);
                  }}
                  className={[
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                    active
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-on-surface)]"
                      : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                    disabled ? "cursor-not-allowed opacity-60" : "",
                  ].join(" ")}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${option.dotClassName}`} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="lesson-video-url" className={lessonFieldLabelClassName}>
            Video URL
          </label>
          <input
            id="lesson-video-url"
            className={inputClass}
            value={videoUrl}
            onChange={(event) => {
              onVideoUrlChange(event.target.value);
            }}
            disabled={disabled}
            readOnly={!editable}
            placeholder="https://youtube.com/watch?v=…"
          />
        </div>

        {embedReady ? (
          <LessonVideoEmbed
            provider={videoProvider}
            url={trimmedVideoUrl}
            title="Video preview"
          />
        ) : (
          <div
            className={[
              "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
              hasVideo ? "" : "opacity-70",
            ].join(" ")}
          >
            <PlayCircle className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs font-semibold">
              {hasVideo ? "Could not preview this URL" : "Preview video"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
