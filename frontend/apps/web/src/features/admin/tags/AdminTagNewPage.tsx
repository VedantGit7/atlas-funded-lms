"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Loader2, Plus, TriangleAlert } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { createTag, fetchTags, slugifyTagTitle, type Tag, type TagVisibility } from "./tags-api";
import {
  findNearDuplicates,
  findSlugClash,
  tagInlineErrorClassName,
  tagNoteClassName,
  tagSlugClassName,
  visibilityLabel,
} from "./tags-shared";
import {
  TagDescriptionField,
  TagSlugPreview,
  TagTitleField,
  TagVisibilityField,
} from "./TagFormFields";

const TAGS_HREF = "/admin/manage/tags";

/**
 * `/admin/manage/tags/new`.
 *
 * A four-field record, so it is a form and not a wizard. Two things make it
 * more than a form, and both come from tags being one shared record:
 *
 * **The duplicate guard.** The vocabulary this screen exists to keep clean is
 * ruined one near-duplicate at a time — "Beginner" beside "beginners" — and the
 * cheapest moment to catch that is before the second one exists. It runs over
 * the full tag list, which is only viable because the list endpoint is
 * deliberately unpaginated. It warns and never blocks: two similarly named tags
 * are sometimes genuinely different, and the operator knows which.
 *
 * **An exact slug clash does block**, because the server will reject it anyway
 * — the unique index on `(tenant_id, slug)` is the real authority. Catching it
 * here turns a failed round-trip into a message on the field.
 */
export function AdminTagNewPage() {
  const router = useRouter();
  const fieldId = useId();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<TagVisibility>("public");
  const [touched, setTouched] = useState(false);

  const [existing, setExisting] = useState<Tag[]>([]);
  const [existingLoaded, setExistingLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The guard needs the whole vocabulary. A failure here is not worth blocking
  // the form for: the server still rejects an exact clash, so the worst case is
  // a warning that does not appear.
  const loadExisting = useCallback(async () => {
    try {
      setExisting(await fetchTags());
    } catch {
      setExisting([]);
    } finally {
      setExistingLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const trimmedTitle = title.trim();
  const slug = slugifyTagTitle(trimmedTitle);

  const exactClash = useMemo(() => findSlugClash(existing, slug), [existing, slug]);

  /** A different title that means the same thing: warned about, never blocked. */
  const nearDuplicates = useMemo(
    () => findNearDuplicates(existing, trimmedTitle, exactClash?.id),
    [existing, trimmedTitle, exactClash],
  );

  const titleMissing = touched && trimmedTitle === "";
  const slugUnusable = trimmedTitle !== "" && slug === "";
  const canSubmit = trimmedTitle !== "" && slug !== "" && exactClash === null && !saving;

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createTag({
        title: trimmedTitle,
        visibility,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      // The list highlights whatever `created` names, so the operator can see
      // where the new tag landed alphabetically instead of hunting for it.
      router.push(`${TAGS_HREF}?created=${encodeURIComponent(created.id)}`);
    } catch (caught) {
      // The entered values stay on screen: re-typing a description because the
      // save failed is the worst thing a create form can do.
      setError(caught instanceof ClientApiError ? caught.message : "Could not create the tag.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <nav aria-label="Breadcrumb" className="font-data flex items-center gap-1.5 text-xs">
        <Link
          href={TAGS_HREF}
          className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
        >
          Tags
        </Link>
        <ChevronRight
          className="h-3 w-3 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <span className="font-semibold text-[var(--admin-on-surface)]">New tag</span>
      </nav>

      <div>
        <h1 className={managePageTitleClassName}>New tag</h1>
        <p className={managePageDescClassName}>Tags are shared across every course and lesson.</p>
      </div>

      <form
        className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        {error ? (
          <p role="alert" className={tagInlineErrorClassName}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        <div>
          <TagTitleField
            id={`${fieldId}-title`}
            value={title}
            disabled={saving}
            invalid={titleMissing || exactClash !== null}
            autoFocus
            onChange={(next) => {
              setTitle(next);
              setTouched(true);
            }}
          />

          {titleMissing ? (
            <p
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-danger)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />A title is
              required.
            </p>
          ) : null}

          {/* A title of only punctuation derives an empty slug, which the server
              rejects with a message that reads as a system fault. */}
          {slugUnusable ? (
            <p
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-danger)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />A title needs at
              least one letter or number.
            </p>
          ) : null}

          {exactClash ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--admin-danger)]">
                  “{exactClash.title}” already uses this slug
                </p>
                <p className={`${tagSlugClassName} mt-0.5`}>{exactClash.slug}</p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  A slug can only belong to one tag. Change the title, or attach the existing tag
                  instead.
                </p>
              </div>
            </div>
          ) : null}

          {nearDuplicates.length > 0 ? (
            <div className={`${tagNoteClassName} mt-3`}>
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  {nearDuplicates.length === 1
                    ? `A tag called “${nearDuplicates[0]?.title ?? ""}” already exists`
                    : `${String(nearDuplicates.length)} similarly named tags already exist`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {nearDuplicates.map((tag) => (
                    <li key={tag.id} className={tagSlugClassName}>
                      {tag.slug} · {visibilityLabel(tag.visibility)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Tags are shared, so a near-duplicate splits the same idea across two labels.
                  Creating this anyway is fine if they genuinely differ — the tag list can merge
                  them later if not.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <TagSlugPreview
          slug={slug}
          caption={
            existingLoaded
              ? "Generated from the title. It cannot be set directly."
              : "Generated from the title. Still checking it against existing tags…"
          }
        />

        <TagDescriptionField
          id={`${fieldId}-description`}
          value={description}
          disabled={saving}
          rows={4}
          onChange={setDescription}
        />

        <TagVisibilityField value={visibility} disabled={saving} onChange={setVisibility} />

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--admin-border)] pt-5 sm:flex-row sm:justify-end">
          <Link href={TAGS_HREF} className={manageSecondaryButtonClassName}>
            Cancel
          </Link>
          <button type="submit" className={managePrimaryButtonClassName} disabled={!canSubmit}>
            {saving ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {saving ? "Creating…" : "Create tag"}
          </button>
        </div>
      </form>
    </div>
  );
}
