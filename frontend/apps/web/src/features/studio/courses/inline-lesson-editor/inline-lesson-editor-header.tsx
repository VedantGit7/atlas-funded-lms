"use client";

import { useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import {
  inlineLessonDangerButtonClassName,
  inlineLessonGhostButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";
import { resolveLessonAccentToken, resolveLessonTypeLabel } from "./lesson-type-meta";
import { DeleteLessonDialog } from "../../lessons/delete-lesson-dialog";

type InlineLessonEditorHeaderProps = {
  courseId: string;
  lessonId: string;
  title: string;
  lessonType: string | null | undefined;
  editable: boolean;
  showPreview?: boolean;
  onDeleted: () => void;
  onOpenSettings?: () => void;
  onOpenPreview?: () => void;
};

export function InlineLessonEditorHeader({
  courseId,
  lessonId,
  title,
  lessonType,
  editable,
  showPreview = true,
  onDeleted,
  onOpenSettings,
  onOpenPreview,
}: InlineLessonEditorHeaderProps) {
  const [showDelete, setShowDelete] = useState(false);
  const typeLabel = resolveLessonTypeLabel(lessonType);
  const accentToken = resolveLessonAccentToken(lessonType);

  return (
    <>
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  color: `var(${accentToken})`,
                  backgroundColor: `color-mix(in srgb, var(${accentToken}) 12%, var(--admin-surface))`,
                }}
              >
                {typeLabel}
              </span>
            </div>
            <h1 className="truncate text-xl font-bold text-[var(--admin-on-surface)] md:text-2xl">
              {title}
            </h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showPreview ? (
              <button
                type="button"
                className={inlineLessonGhostButtonClassName}
                onClick={onOpenPreview}
              >
                Preview
              </button>
            ) : null}
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Settings
            </button>
            {editable ? (
              <button
                type="button"
                className={inlineLessonDangerButtonClassName}
                onClick={() => {
                  setShowDelete(true);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Move To Trash
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <DeleteLessonDialog
        open={showDelete}
        lessonId={lessonId}
        courseId={courseId}
        inline
        onClose={() => {
          setShowDelete(false);
        }}
        onDeleted={onDeleted}
      />
    </>
  );
}
