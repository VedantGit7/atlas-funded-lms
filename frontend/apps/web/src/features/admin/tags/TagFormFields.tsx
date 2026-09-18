"use client";

import type { ReactNode, RefObject } from "react";
import { Info, Link2 } from "lucide-react";
import {
  TAG_DESCRIPTION_MAX,
  TAG_TITLE_MAX,
  TAG_VISIBILITIES,
  type TagVisibility,
} from "./tags-api";
import {
  tagFieldClassName,
  tagFieldLabelClassName,
  tagSegmentActiveClassName,
  tagSegmentClassName,
  tagSegmentedGroupClassName,
  tagSlugClassName,
  visibilityCaption,
  visibilityLabel,
} from "./tags-shared";

/**
 * The four controls a tag is made of, shared by the inline row editor and the
 * standalone create page.
 *
 * They live in one place because the parts that are easy to get subtly wrong —
 * the counters, the limits, the three visibility values and their captions —
 * must be identical on both surfaces. Two hand-written copies is how a form
 * ends up offering three values in one place and two in the other, which is
 * exactly the bug this module started with.
 */

/** Counter turns Warning inside the last ten characters, never after the fact. */
function CharacterCount({ length, max }: { length: number; max: number }) {
  return (
    <span
      className={`font-data tabular-nums ${
        max - length <= 10 ? "text-[var(--admin-warning)]" : ""
      }`}
    >
      {String(length)}/{String(max)}
    </span>
  );
}

export function TagTitleField({
  id,
  value,
  onChange,
  disabled,
  invalid = false,
  inputRef,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className={tagFieldLabelClassName} htmlFor={id}>
        <span>
          Title <span className="text-[var(--admin-danger)]">*</span>
        </span>
        <CharacterCount length={value.length} max={TAG_TITLE_MAX} />
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        className={[
          tagFieldClassName,
          invalid
            ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/25"
            : "",
        ].join(" ")}
        maxLength={TAG_TITLE_MAX}
        placeholder="e.g. Risk management"
        value={value}
        disabled={disabled}
        required
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        // The create page is a single-purpose form reached deliberately, and the
        // title is its only entry point; the inline editor leaves this off and
        // moves focus itself.
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p id={`${id}-help`} className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
        Shown wherever the tag appears.
      </p>
    </div>
  );
}

export function TagDescriptionField({
  id,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className={tagFieldLabelClassName} htmlFor={id}>
        <span>Description</span>
        <CharacterCount length={value.length} max={TAG_DESCRIPTION_MAX} />
      </label>
      <textarea
        id={id}
        className={`${tagFieldClassName} resize-y`}
        maxLength={TAG_DESCRIPTION_MAX}
        rows={rows}
        placeholder="Briefly describe what this tag represents."
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
        One short sentence. Optional.
      </p>
    </div>
  );
}

/**
 * All three stored values, always.
 *
 * A two-option control is not a smaller version of this — it is a control that
 * silently rewrites any tag holding the third value the moment it is saved.
 */
export function TagVisibilityField({
  value,
  onChange,
  disabled,
}: {
  value: TagVisibility;
  onChange: (next: TagVisibility) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--admin-on-surface-variant)]">
        Visibility
      </span>
      <div className={tagSegmentedGroupClassName} role="radiogroup" aria-label="Visibility">
        {TAG_VISIBILITIES.map((option, index) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            disabled={disabled}
            className={[
              tagSegmentClassName,
              index > 0 ? "border-l border-[var(--admin-outline)]" : "",
              option === value ? tagSegmentActiveClassName : "",
            ].join(" ")}
            onClick={() => {
              onChange(option);
            }}
          >
            {visibilityLabel(option)}
          </button>
        ))}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {visibilityCaption(value)}
      </p>
    </div>
  );
}

/**
 * The derived slug, read-only.
 *
 * Never an editable field: the create and update bodies carry no slug, so an
 * input here would accept a value the server discards.
 */
export function TagSlugPreview({
  slug,
  caption,
  trailing,
}: {
  slug: string;
  caption: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--admin-on-surface-variant)]">
        Slug
      </span>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
        <span className={tagSlugClassName}>
          <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {slug || "—"}
        </span>
        {trailing}
      </div>
      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}
