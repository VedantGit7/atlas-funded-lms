"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { slugifyTagTitle, type TagVisibility } from "./tags-api";
import { tagInlineErrorClassName } from "./tags-shared";
import {
  TagDescriptionField,
  TagSlugPreview,
  TagTitleField,
  TagVisibilityField,
} from "./TagFormFields";

export type TagEditorValues = {
  title: string;
  description: string;
  visibility: TagVisibility;
};

type TagEditorPanelProps = {
  initial: TagEditorValues;
  /** The stored slug, so a rename's effect on it is visible before saving. */
  currentSlug: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: TagEditorValues) => void;
  onCancel: () => void;
  onCopySlug: (slug: string) => void;
};

/**
 * The inline edit form, expanded under the row it was opened from.
 *
 * Creating happens on its own route rather than here — a new tag has no row to
 * expand under, and the create screen carries a duplicate guard that only makes
 * sense before a tag exists. What both surfaces share is the field set itself,
 * which lives in `TagFormFields` so the counters, limits and the three
 * visibility values cannot drift between them.
 */
export function TagEditorPanel({
  initial,
  currentSlug,
  busy,
  error,
  onSubmit,
  onCancel,
  onCopySlug,
}: TagEditorPanelProps) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [visibility, setVisibility] = useState<TagVisibility>(initial.visibility);
  const titleRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  // Opening the panel should put the cursor where the work is, and re-opening
  // it on a different row must reset the fields rather than carry the previous
  // row's edits across.
  useEffect(() => {
    setTitle(initial.title);
    setDescription(initial.description);
    setVisibility(initial.visibility);
    titleRef.current?.focus();
  }, [initial.title, initial.description, initial.visibility]);

  const trimmedTitle = title.trim();
  const nextSlug = slugifyTagTitle(trimmedTitle);
  const slugChanged = nextSlug !== currentSlug;
  const canSubmit = trimmedTitle.length > 0 && nextSlug.length > 0 && !busy;

  function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ title: trimmedTitle, description: description.trim(), visibility });
  }

  return (
    <form
      className="grid gap-5 border-l-2 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] p-5 motion-safe:animate-[admin-fade-in_0.18s_ease-out] md:grid-cols-2"
      onSubmit={handleSubmit}
    >
      {error ? (
        <p role="alert" className={`${tagInlineErrorClassName} md:col-span-2`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <TagTitleField
          id={`${fieldId}-title`}
          value={title}
          disabled={busy}
          inputRef={titleRef}
          onChange={setTitle}
        />
        <TagDescriptionField
          id={`${fieldId}-description`}
          value={description}
          disabled={busy}
          onChange={setDescription}
        />
      </div>

      <div className="space-y-4">
        <TagVisibilityField value={visibility} disabled={busy} onChange={setVisibility} />
        <TagSlugPreview
          slug={nextSlug}
          trailing={
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
              aria-label={`Copy slug ${currentSlug}`}
              onClick={() => {
                onCopySlug(currentSlug);
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          }
          caption={
            slugChanged ? (
              <span className="text-[var(--admin-warning)]">
                Saving changes the slug from “{currentSlug}” to “{nextSlug}”. Anything referring to
                the old slug will stop matching.
              </span>
            ) : (
              "Derived from the title. It cannot be set directly."
            )
          }
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] pt-4 md:col-span-2">
        <button
          type="button"
          className={manageSecondaryButtonClassName}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className={managePrimaryButtonClassName} disabled={!canSubmit}>
          {busy ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Save changes
        </button>
      </div>
    </form>
  );
}
