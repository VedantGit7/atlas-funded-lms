"use client";

import { useId, useState } from "react";
import { ChevronLeft, CircleHelp } from "lucide-react";
import type { TagSummary } from "@atlas/contracts/tags/tag-schemas";
import { inlineExpandClassName } from "../admin-form-dropdown-shared";
import { builderHelperClassName, builderTextareaClassName } from "../course-builder-shared";
import { lessonInputClassName } from "../../lessons/lesson-editor-shared";
import {
  LESSON_TAG_DESCRIPTION_MAX_LENGTH,
  LESSON_TAG_TITLE_MAX_LENGTH,
  type LessonTagVisibility,
} from "./lesson-settings-metadata";
import {
  createEntityTag,
  formatTagError,
  type StudioTagScope,
} from "./studio-tags-client";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";
import { LessonSettingsFieldLabel } from "./inline-lesson-settings-shared";

const VISIBILITY_OPTIONS: Array<{
  value: LessonTagVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "public",
    label: "Public",
    description: "Visible to everyone, allowing learners to filter products based on tags",
  },
  {
    value: "private",
    label: "Private",
    description: "Used only by admins for internal categorization and not visible to learners",
  },
  {
    value: "classification",
    label: "Classification",
    description: "Admin-only tags applied exclusively to questions and polls",
  },
];

type CreateTagDraft = {
  title: string;
  visibility: LessonTagVisibility;
  description: string;
};

type StudioCreateTagScreenProps = {
  tagScope: StudioTagScope;
  entityId: string;
  disabled: boolean;
  onBack: () => void;
  onCreated: (tags: TagSummary[]) => void;
};

function createEmptyDraft(): CreateTagDraft {
  return {
    title: "",
    visibility: "public",
    description: "",
  };
}

export function StudioCreateTagScreen({
  tagScope,
  entityId,
  disabled,
  onBack,
  onCreated,
}: StudioCreateTagScreenProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [draft, setDraft] = useState<CreateTagDraft>(createEmptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const title = draft.title.trim();
    if (!title || disabled || saving) return;

    setSaving(true);
    setError(null);
    try {
      const result = await createEntityTag(tagScope, entityId, {
        title,
        visibility: draft.visibility,
        description: draft.description.trim() || undefined,
      });
      setDraft(createEmptyDraft());
      onCreated(result.attachedTags);
    } catch (createError) {
      setError(formatTagError(createError));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saving) return;
    setDraft(createEmptyDraft());
    setError(null);
    onBack();
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
            disabled={saving}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <p className="text-sm font-semibold text-[var(--admin-primary-strong)]">Create Tag</p>
          <header className="mb-8 mt-1">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">
              Create Tag
            </h1>
            <p className={`${builderHelperClassName} mt-2`}>
              Create a tag to classify your content.
            </p>
          </header>

          {error ? (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
            <div className="space-y-6">
              <div>
                <LessonSettingsFieldLabel
                  htmlFor={titleId}
                  label="Title"
                  required
                  counter={`${draft.title.length}/${LESSON_TAG_TITLE_MAX_LENGTH}`}
                />
                <input
                  id={titleId}
                  className={lessonInputClassName}
                  value={draft.title}
                  maxLength={LESSON_TAG_TITLE_MAX_LENGTH}
                  placeholder="Enter tag title"
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, title: event.target.value }));
                    setError(null);
                  }}
                />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Tag Visibility<span className="text-[var(--admin-danger)]">*</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
                    aria-label="Tag visibility help"
                  >
                    <CircleHelp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-3" role="radiogroup" aria-label="Tag visibility">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const selected = draft.visibility === option.value;
                    return (
                      <label
                        key={option.value}
                        className={[
                          "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                          selected
                            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                            : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                          disabled || saving ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                            selected
                              ? "border-[var(--admin-primary)]"
                              : "border-[var(--admin-outline)]",
                          ].join(" ")}
                        >
                          {selected ? (
                            <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                            {option.label}
                          </span>
                          <span className={`${builderHelperClassName} mt-1 block`}>
                            {option.description}
                          </span>
                        </span>
                        <input
                          type="radio"
                          name={`${tagScope}-tag-visibility`}
                          value={option.value}
                          checked={selected}
                          disabled={disabled || saving}
                          className="sr-only"
                          onChange={() => {
                            setDraft((current) => ({ ...current, visibility: option.value }));
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <LessonSettingsFieldLabel
                  htmlFor={descriptionId}
                  label="Description"
                  counter={`${draft.description.length}/${LESSON_TAG_DESCRIPTION_MAX_LENGTH}`}
                />
                <textarea
                  id={descriptionId}
                  className={builderTextareaClassName}
                  rows={4}
                  value={draft.description}
                  maxLength={LESSON_TAG_DESCRIPTION_MAX_LENGTH}
                  placeholder="Tag description"
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, description: event.target.value }));
                  }}
                />
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-[var(--admin-border)] pt-8">
            <button
              type="button"
              className={inlineLessonPrimaryDarkButtonClassName}
              disabled={disabled || saving || !draft.title.trim()}
              onClick={() => {
                void handleCreate();
              }}
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={saving}
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type InlineLessonCreateTagScreenProps = {
  lessonId: string;
  disabled: boolean;
  onBack: () => void;
  onCreated: (tags: TagSummary[]) => void;
};

export function InlineLessonCreateTagScreen({
  lessonId,
  ...props
}: InlineLessonCreateTagScreenProps) {
  return <StudioCreateTagScreen tagScope="lesson" entityId={lessonId} {...props} />;
}
