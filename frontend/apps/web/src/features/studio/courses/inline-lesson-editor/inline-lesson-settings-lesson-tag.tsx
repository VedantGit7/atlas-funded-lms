"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { TagSummary } from "@atlas/contracts/tags/tag-schemas";
import { LessonTagEmptyIllustrationGraphic } from "./lesson-tag-empty-illustration";
import { builderHelperClassName } from "../course-builder-shared";
import {
  detachEntityTag,
  fetchEntityTags,
  formatTagError,
  type StudioTagScope,
} from "./studio-tags-client";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";

export type StudioTagListLayout = "lesson-settings" | "course-settings";

const LIST_COPY: Record<
  StudioTagListLayout,
  { title: string; subtitle: string; emptyHint: string }
> = {
  "lesson-settings": {
    title: "Lesson Tag",
    subtitle: "Add lesson tag to make the lesson easy to filter for learners",
    emptyHint: "Add a tag to your lesson.",
  },
  "course-settings": {
    title: "Tags",
    subtitle: "Add course tag to make the course easy to filter for learners",
    emptyHint: "Add a tag to your course.",
  },
};

type StudioTagListSectionProps = {
  tagScope: StudioTagScope;
  entityId: string;
  disabled: boolean;
  layout: StudioTagListLayout;
  onCreateTag: () => void;
  onAttachTag: () => void;
  refreshToken?: number;
  onTagsChange?: (tags: TagSummary[]) => void;
};

function tagVisibilityLabel(visibility: TagSummary["visibility"]): string {
  if (visibility === "private") return "Private";
  if (visibility === "classification") return "Classification";
  return "Public";
}

export function StudioTagListSection({
  tagScope,
  entityId,
  disabled,
  layout,
  onCreateTag,
  onAttachTag,
  refreshToken = 0,
  onTagsChange,
}: StudioTagListSectionProps) {
  const copy = LIST_COPY[layout];
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const showHeader = layout === "lesson-settings";

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchEntityTags(tagScope, entityId);
      setTags(items);
      onTagsChange?.(items);
    } catch (loadError) {
      setError(formatTagError(loadError));
    } finally {
      setLoading(false);
    }
  }, [entityId, onTagsChange, tagScope]);

  useEffect(() => {
    void loadTags();
  }, [loadTags, refreshToken]);

  async function handleRemove(tagId: string) {
    if (disabled || removingTagId) return;
    setRemovingTagId(tagId);
    setError(null);
    try {
      const items = await detachEntityTag(tagScope, entityId, tagId);
      setTags(items);
      onTagsChange?.(items);
    } catch (removeError) {
      setError(formatTagError(removeError));
    } finally {
      setRemovingTagId(null);
    }
  }

  const hasTags = tags.length > 0;

  return (
    <div className="space-y-6">
      <div
        className={
          showHeader
            ? "flex items-start justify-between gap-4"
            : "flex items-start justify-end gap-4"
        }
      >
        {showHeader ? (
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-[var(--admin-on-surface)]">{copy.title}</h2>
            <p className={`${builderHelperClassName} mt-2 max-w-xl`}>{copy.subtitle}</p>
          </div>
        ) : null}
        <button
          type="button"
          className={inlineLessonSecondaryButtonClassName}
          disabled={disabled || loading}
          onClick={onCreateTag}
        >
          Create Tag
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading tags…</p>
      ) : null}

      {!loading && hasTags ? (
        <ul className="space-y-3">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{tag.title}</p>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-primary-strong)]">
                    {tagVisibilityLabel(tag.visibility)}
                  </span>
                </div>
                {tag.description ? (
                  <p className={`${builderHelperClassName} mt-1`}>{tag.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                disabled={disabled || removingTagId === tag.id}
                aria-label={`Remove ${tag.title}`}
                onClick={() => {
                  void handleRemove(tag.id);
                }}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !hasTags ? (
        <section className="flex min-h-[min(22rem,calc(100vh-20rem))] flex-col items-center justify-center px-6 py-12 text-center">
          <LessonTagEmptyIllustrationGraphic />
          <h3 className="mt-8 text-lg font-bold text-[var(--admin-on-surface)]">Add Tag</h3>
          <p className={`${builderHelperClassName} mt-2`}>{copy.emptyHint}</p>
          <button
            type="button"
            className={`${inlineLessonPrimaryDarkButtonClassName} mt-8 gap-2`}
            disabled={disabled}
            onClick={onAttachTag}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Add tag
          </button>
        </section>
      ) : null}

      {!loading && hasTags ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className={`${inlineLessonPrimaryDarkButtonClassName} gap-2`}
            disabled={disabled}
            onClick={onAttachTag}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Add tag
          </button>
        </div>
      ) : null}
    </div>
  );
}

type LessonSettingsLessonTagSectionProps = {
  lessonId: string;
  disabled: boolean;
  onCreateTag: () => void;
  onAttachTag: () => void;
  refreshToken?: number;
  onTagsChange?: (tags: TagSummary[]) => void;
};

export function LessonSettingsLessonTagSection({
  lessonId,
  ...props
}: LessonSettingsLessonTagSectionProps) {
  return (
    <StudioTagListSection
      tagScope="lesson"
      entityId={lessonId}
      layout="lesson-settings"
      {...props}
    />
  );
}
