"use client";

import { Clock, Settings2 } from "lucide-react";
import {
  lessonCardClassName,
  lessonCardTitleClassName,
  lessonFieldLabelClassName,
  lessonInputClassName,
  lessonLockedInputClassName,
  lessonTextareaClassName,
} from "./lesson-editor-shared";

type LessonSettingsCardProps = {
  title: string;
  description: string;
  durationMmSs: string;
  editable: boolean;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDurationChange: (value: string) => void;
};

export function LessonSettingsCard({
  title,
  description,
  durationMmSs,
  editable,
  saving,
  onTitleChange,
  onDescriptionChange,
  onDurationChange,
}: LessonSettingsCardProps) {
  const disabled = !editable || saving;
  const inputClass = editable ? lessonInputClassName : lessonLockedInputClassName;
  const textareaClass = editable ? lessonTextareaClassName : lessonLockedInputClassName;

  return (
    <section className={lessonCardClassName}>
      <div className="flex items-center gap-2 text-[var(--admin-on-surface)]">
        <Settings2 className="h-[18px] w-[18px] text-[var(--admin-primary)]" aria-hidden="true" />
        <h2 className={lessonCardTitleClassName}>Lesson Settings</h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="lesson-title" className={lessonFieldLabelClassName}>
            Title <span className="text-[var(--admin-danger)]">*</span>
          </label>
          <input
            id="lesson-title"
            className={inputClass}
            value={title}
            onChange={(event) => {
              onTitleChange(event.target.value);
            }}
            disabled={disabled}
            readOnly={!editable}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="lesson-description" className={lessonFieldLabelClassName}>
            Description
          </label>
          <textarea
            id="lesson-description"
            className={textareaClass}
            rows={3}
            value={description}
            onChange={(event) => {
              onDescriptionChange(event.target.value);
            }}
            disabled={disabled}
            readOnly={!editable}
            placeholder="Brief summary of what learners will cover…"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="lesson-duration" className={lessonFieldLabelClassName}>
            Duration (mm:ss)
          </label>
          <div className="relative">
            <Clock
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-outline)]"
              aria-hidden="true"
            />
            <input
              id="lesson-duration"
              className={`${inputClass} pl-10`}
              value={durationMmSs}
              onChange={(event) => {
                onDurationChange(event.target.value);
              }}
              disabled={disabled}
              readOnly={!editable}
              placeholder="12:45"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
