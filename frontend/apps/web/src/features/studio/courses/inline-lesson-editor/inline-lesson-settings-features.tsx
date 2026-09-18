"use client";

import { RoleToggle } from "../admin-form-dropdown-shared";
import type { LessonSettingsFormState } from "./lesson-settings-metadata";
import { LessonSettingsFieldLabel } from "./inline-lesson-settings-shared";

type LessonSettingsFeaturesSectionProps = {
  form: LessonSettingsFormState;
  disabled: boolean;
  onChange: (patch: Partial<LessonSettingsFormState>) => void;
};

export function LessonSettingsFeaturesSection({
  form,
  disabled,
  onChange,
}: LessonSettingsFeaturesSectionProps) {
  function updateFeature(key: keyof LessonSettingsFormState["features"], checked: boolean) {
    onChange({
      features: {
        ...form.features,
        [key]: checked,
      },
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <LessonSettingsFieldLabel
        label="Lesson features"
        helper="Toggle optional capabilities learners can use with this lesson."
      />
      <div className="divide-y divide-[var(--admin-border)]">
        <div className="py-3">
          <RoleToggle
            label="Allow comments"
            checked={form.features.allowComments}
            disabled={disabled}
            onChange={(checked) => {
              updateFeature("allowComments", checked);
            }}
          />
        </div>
        <div className="py-3">
          <RoleToggle
            label="Enable downloads"
            checked={form.features.enableDownloads}
            disabled={disabled}
            onChange={(checked) => {
              updateFeature("enableDownloads", checked);
            }}
          />
        </div>
        <div className="py-3">
          <RoleToggle
            label="Show transcript"
            checked={form.features.showTranscript}
            disabled={disabled}
            onChange={(checked) => {
              updateFeature("showTranscript", checked);
            }}
          />
        </div>
      </div>
      {form.features.showTranscript ? (
        <div>
          <LessonSettingsFieldLabel
            label="Transcript"
            helper="Plain text shown to learners when transcript is enabled."
          />
          <textarea
            className="min-h-[8rem] w-full resize-y rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            placeholder="Paste or type lesson transcript"
            value={form.transcriptText}
            disabled={disabled}
            onChange={(event) => {
              onChange({ transcriptText: event.target.value });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
