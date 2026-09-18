"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, ArrowRight, Combine, Loader2, X } from "lucide-react";
import {
  manageDangerButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import type { Tag } from "./tags-api";
import {
  tagInlineErrorClassName,
  tagSlugClassName,
  usageLabel,
  visibilityChipClassName,
  visibilityLabel,
} from "./tags-shared";

type TagMergeDialogProps = {
  open: boolean;
  /** Exactly the two selected tags, in list order. */
  candidates: [Tag, Tag] | null;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { sourceTagIds: string[]; targetTagId: string }) => void;
  onCancel: () => void;
};

/**
 * Folds one tag into another.
 *
 * The list flags near-duplicates, and flagging them with no way to resolve them
 * is a dead end — so this is the resolution. It asks which of the two survives
 * rather than guessing, because the answer is not derivable: the better-named
 * tag is often the less-used one.
 *
 * Merging is destructive in one direction only. Every course and lesson on the
 * folded tag keeps its tagging, re-pointed at the survivor; the folded tag is
 * then deleted. There is no undo, which the confirm copy says out loud.
 */
export function TagMergeDialog({
  open,
  candidates,
  busy,
  error,
  onSubmit,
  onCancel,
}: TagMergeDialogProps) {
  const headingId = useId();
  const [keepId, setKeepId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !candidates) return;

    // Default to keeping the more-used tag: re-pointing the smaller side is the
    // cheaper mistake if the operator confirms without reading.
    const [first, second] = candidates;
    const firstUsage = (first.usage?.courses ?? 0) + (first.usage?.lessons ?? 0);
    const secondUsage = (second.usage?.courses ?? 0) + (second.usage?.lessons ?? 0);
    setKeepId(secondUsage > firstUsage ? second.id : first.id);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, candidates, busy, onCancel]);

  if (!open || !candidates) return null;

  const keep = candidates.find((tag) => tag.id === keepId) ?? candidates[0];
  const fold = candidates.find((tag) => tag.id !== keep.id) ?? candidates[1];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]">
              <Combine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={headingId} className="text-base font-bold text-[var(--admin-on-surface)]">
                Merge two tags
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Choose which tag survives. The other is removed and everything it is attached to
                keeps its tagging, moved onto the one you keep.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className={tagInlineErrorClassName}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Keep this tag
            </legend>
            {candidates.map((tag) => (
              <label
                key={tag.id}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                  tag.id === keep.id
                    ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                    : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="tag-merge-keep"
                  className="mt-1 h-4 w-4 accent-[var(--admin-primary)]"
                  checked={tag.id === keep.id}
                  onChange={() => {
                    setKeepId(tag.id);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {tag.title}
                    </span>
                    <span className={visibilityChipClassName(tag.visibility)}>
                      {visibilityLabel(tag.visibility)}
                    </span>
                  </span>
                  <span className={`${tagSlugClassName} mt-0.5`}>{tag.slug}</span>
                  <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                    {usageLabel(tag.usage)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_32%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-on-surface)]">
            <span className="font-semibold">“{fold.title}”</span>
            <ArrowRight className="h-4 w-4 text-[var(--admin-warning)]" aria-hidden="true" />
            <span className="font-semibold">“{keep.title}”</span>
            <span className="w-full text-xs text-[var(--admin-on-surface-variant)]">
              “{fold.title}” is deleted. This cannot be undone, and the tag’s description and
              visibility are not carried over — only its attachments.
            </span>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={manageDangerButtonClassName}
            disabled={busy}
            onClick={() => {
              onSubmit({ sourceTagIds: [fold.id], targetTagId: keep.id });
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Combine className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "Merging…" : `Merge into “${keep.title}”`}
          </button>
        </footer>
      </div>
    </div>
  );
}
