"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { inlineExpandClassName } from "../admin-form-dropdown-shared";
import {
  buildLessonSettingsPayload,
  lessonSettingsFromDetail,
  type LessonSettingsFormState,
  type LessonSettingsSection,
} from "./lesson-settings-metadata";
import { LessonSettingsBrandingSection } from "./inline-lesson-settings-branding";
import { LessonSettingsFeaturesSection } from "./inline-lesson-settings-features";
import { LessonSettingsLessonTagSection } from "./inline-lesson-settings-lesson-tag";
import { InlineLessonCreateTagScreen } from "./inline-lesson-create-tag-screen";
import { InlineLessonAttachTagScreen } from "./inline-lesson-attach-tag-screen";
import {
  LessonSettingsShell,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-settings-shared";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type InlineLessonSettingsPanelProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
  onBack: () => void;
  onSaved: (lesson: StudioLessonDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save lesson settings.";
}

export function InlineLessonSettingsPanel({
  lesson,
  editable,
  onBack,
  onSaved,
}: InlineLessonSettingsPanelProps) {
  const [section, setSection] = useState<LessonSettingsSection>("branding");
  const [lessonTagView, setLessonTagView] = useState<"list" | "create" | "attach">("list");
  const [lessonTagsRefreshToken, setLessonTagsRefreshToken] = useState(0);
  const [form, setForm] = useState<LessonSettingsFormState>(() => lessonSettingsFromDetail(lesson));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(lessonSettingsFromDetail(lesson));
  }, [lesson]);

  useEffect(() => {
    if (section !== "lesson_tag") {
      setLessonTagView("list");
    }
  }, [section]);

  function patchForm(patch: Partial<LessonSettingsFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function handleCancel() {
    setForm(lessonSettingsFromDetail(lesson));
    setError(null);
    onBack();
  }

  async function handleSave() {
    if (!editable || saving) return;
    if (!form.title.trim()) {
      setError("Title is required.");
      setSection("branding");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildLessonSettingsPayload(lesson, form);
      await clientApi.put(`/api/v1/lessons/${lesson.id}`, payload, "lesson-settings-save");
      const response = await clientApi.get<{ data: StudioLessonDetail }>(
        `/api/v1/lessons/${lesson.id}?view=studio`,
      );
      onSaved(response.data);
      setForm(lessonSettingsFromDetail(response.data));
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setSaving(false);
    }
  }

  const disabled = !editable || saving;
  const showCreateTag = section === "lesson_tag" && lessonTagView === "create";
  const showAttachTag = section === "lesson_tag" && lessonTagView === "attach";

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      {error ? (
        <p
          role="alert"
          className="border-b border-[var(--admin-danger)]/25 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-2.5 text-sm text-[var(--admin-danger)] md:px-6"
        >
          {error}
        </p>
      ) : null}

      {!editable ? (
        <p className="border-b border-[var(--admin-warning)]/25 bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-4 py-2.5 text-sm text-[var(--admin-warning)] md:px-6">
          This lesson is locked while in review or published.
        </p>
      ) : null}

      {showCreateTag ? (
        <InlineLessonCreateTagScreen
          lessonId={lesson.id}
          disabled={disabled}
          onBack={() => {
            setLessonTagView("list");
          }}
          onCreated={() => {
            setLessonTagsRefreshToken((value) => value + 1);
            setLessonTagView("list");
          }}
        />
      ) : showAttachTag ? (
        <InlineLessonAttachTagScreen
          lessonId={lesson.id}
          disabled={disabled}
          onBack={() => {
            setLessonTagView("list");
          }}
          onCreateTag={() => {
            setLessonTagView("create");
          }}
          onAttached={() => {
            setLessonTagsRefreshToken((value) => value + 1);
          }}
        />
      ) : (
        <LessonSettingsShell
          section={section}
          onSectionChange={setSection}
          onBack={onBack}
          footer={
            <>
              <button
                type="button"
                className={inlineLessonPrimaryDarkButtonClassName}
                disabled={disabled}
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={inlineLessonSecondaryButtonClassName}
                disabled={saving}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </>
          }
        >
          {section === "branding" ? (
            <LessonSettingsBrandingSection
              lessonId={lesson.id}
              form={form}
              disabled={disabled}
              onChange={patchForm}
            />
          ) : null}
          {section === "lesson_tag" ? (
            <LessonSettingsLessonTagSection
              lessonId={lesson.id}
              disabled={disabled}
              refreshToken={lessonTagsRefreshToken}
              onCreateTag={() => {
                setLessonTagView("create");
              }}
              onAttachTag={() => {
                setLessonTagView("attach");
              }}
            />
          ) : null}
          {section === "features" ? (
            <LessonSettingsFeaturesSection form={form} disabled={disabled} onChange={patchForm} />
          ) : null}
        </LessonSettingsShell>
      )}
    </div>
  );
}
