"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import type { TagSummary } from "@atlas/contracts/tags/tag-schemas";
import { inlineExpandClassName } from "../admin-form-dropdown-shared";
import { builderHelperClassName } from "../course-builder-shared";
import { lessonInputClassName } from "../../lessons/lesson-editor-shared";
import {
  attachTagToEntity,
  fetchEntityTags,
  fetchTenantTags,
  formatTagError,
  type StudioTagScope,
} from "./studio-tags-client";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";

type StudioAttachTagScreenProps = {
  tagScope: StudioTagScope;
  entityId: string;
  disabled: boolean;
  onBack: () => void;
  onCreateTag: () => void;
  onAttached: (tags: TagSummary[]) => void;
};

function tagVisibilityLabel(visibility: TagSummary["visibility"]): string {
  if (visibility === "private") return "Private";
  if (visibility === "classification") return "Classification";
  return "Public";
}

export function StudioAttachTagScreen({
  tagScope,
  entityId,
  disabled,
  onBack,
  onCreateTag,
  onAttached,
}: StudioAttachTagScreenProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [catalogTags, setCatalogTags] = useState<TagSummary[]>([]);
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachingTagId, setAttachingTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, attached] = await Promise.all([
        fetchTenantTags(),
        fetchEntityTags(tagScope, entityId),
      ]);
      setCatalogTags(catalog);
      setAttachedIds(attached.map((tag) => tag.id));
    } catch (loadError) {
      setError(formatTagError(loadError));
    } finally {
      setLoading(false);
    }
  }, [entityId, tagScope]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableTags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogTags
      .filter((tag) => !attachedIds.includes(tag.id))
      .filter((tag) => {
        if (!query) return true;
        return (
          tag.title.toLowerCase().includes(query) ||
          tag.slug.toLowerCase().includes(query) ||
          (tag.description?.toLowerCase().includes(query) ?? false)
        );
      });
  }, [attachedIds, catalogTags, search]);

  async function handleAttach(tagId: string) {
    if (disabled || attachingTagId) return;
    setAttachingTagId(tagId);
    setError(null);
    try {
      const items = await attachTagToEntity(tagScope, entityId, tagId, attachedIds);
      setAttachedIds(items.map((tag) => tag.id));
      onAttached(items);
    } catch (attachError) {
      setError(formatTagError(attachError));
    } finally {
      setAttachingTagId(null);
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
            disabled={Boolean(attachingTagId)}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <p className="text-sm font-semibold text-[var(--admin-primary-strong)]">Add Tag</p>
          <header className="mb-6 mt-1">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">Add Tag</h1>
            <p className={`${builderHelperClassName} mt-2`}>
              Choose an existing tag from your catalog or create a new one.
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

          <div className="mb-4">
            <label htmlFor={searchId} className="sr-only">
              Search tags
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id={searchId}
                className={`${lessonInputClassName} pl-10`}
                placeholder="Search tags"
                value={search}
                disabled={disabled || loading}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                Loading tags…
              </p>
            ) : null}

            {!loading && availableTags.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {catalogTags.length === attachedIds.length
                    ? `All catalog tags are already on this ${tagScope}.`
                    : "No tags match your search."}
                </p>
                <p className={`${builderHelperClassName} mt-2`}>
                  Create a new tag if you cannot find the one you need.
                </p>
                <button
                  type="button"
                  className={`${inlineLessonPrimaryDarkButtonClassName} mt-6 gap-2`}
                  disabled={disabled}
                  onClick={onCreateTag}
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  Create tag
                </button>
              </div>
            ) : null}

            {!loading && availableTags.length > 0 ? (
              <ul className="divide-y divide-[var(--admin-border)]">
                {availableTags.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled || attachingTagId === tag.id}
                      onClick={() => {
                        void handleAttach(tag.id);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                          {tag.title}
                        </span>
                        {tag.description ? (
                          <span className={`${builderHelperClassName} mt-1 block`}>
                            {tag.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-primary-strong)]">
                        {tagVisibilityLabel(tag.visibility)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={disabled || loading}
              onClick={onCreateTag}
            >
              Create new tag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type InlineLessonAttachTagScreenProps = {
  lessonId: string;
  disabled: boolean;
  onBack: () => void;
  onCreateTag: () => void;
  onAttached: (tags: TagSummary[]) => void;
};

export function InlineLessonAttachTagScreen({
  lessonId,
  ...props
}: InlineLessonAttachTagScreenProps) {
  return <StudioAttachTagScreen tagScope="lesson" entityId={lessonId} {...props} />;
}
