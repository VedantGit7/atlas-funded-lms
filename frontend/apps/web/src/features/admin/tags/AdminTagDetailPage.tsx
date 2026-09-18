"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Combine,
  Copy,
  FileText,
  History,
  Loader2,
  Pencil,
  SearchX,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError } from "../../../lib/client-api";
import {
  manageDangerButtonClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  deleteTag,
  fetchTag,
  fetchTagAudit,
  fetchTagUsage,
  fetchTags,
  mergeTags,
  slugifyTagTitle,
  updateTag,
  type Tag,
  type TagAuditEntry,
  type TagDetail,
  type TagUsageDetail,
  type TagVisibility,
} from "./tags-api";
import {
  findNearDuplicates,
  formatTagRelative,
  formatTagTimestamp,
  tagAuditActionLabel,
  tagEmptyPanelClassName,
  tagInlineErrorClassName,
  tagNoteClassName,
  tagSlugClassName,
  usageLabel,
  visibilityChipClassName,
  visibilityLabel,
} from "./tags-shared";
import {
  TagDescriptionField,
  TagSlugPreview,
  TagTitleField,
  TagVisibilityField,
} from "./TagFormFields";
import { TagMergeDialog } from "./TagMergeDialog";

const TAGS_HREF = "/admin/manage/tags";

const panelClassName = "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";
const panelHeaderClassName =
  "border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3";

/**
 * `/admin/manage/tags/[tagId]`.
 *
 * The single-tag view. It holds the edit form at full size, and around it the
 * three things a shared record needs before anyone changes it: where it is
 * attached, what else in the vocabulary means the same thing, and what has
 * already been done to it.
 *
 * The module's design brief described this screen's usage panel as necessarily
 * empty — "This console can list the tags on a course or lesson, but cannot yet
 * list the courses and lessons carrying a tag." That was true of the API and
 * never of the database, and the reverse lookup now exists, so the panel is
 * real. Renaming and deleting still confirm, because both are global.
 */
export function AdminTagDetailPage({ tagId }: { tagId: string }) {
  const router = useRouter();
  const fieldId = useId();

  const [tag, setTag] = useState<TagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<TagVisibility>("public");

  const [usage, setUsage] = useState<TagUsageDetail | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [siblings, setSiblings] = useState<Tag[]>([]);
  const [history, setHistory] = useState<TagAuditEntry[] | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRename, setPendingRename] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [mergeWith, setMergeWith] = useState<Tag | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    try {
      const detail = await fetchTag(tagId);
      setTag(detail);
      setTitle(detail.title);
      setDescription(detail.description ?? "");
      setVisibility(detail.visibility);
    } catch (caught) {
      // A deleted tag is not a failure to report — it is a page that should say
      // what happened and offer the way back.
      if (caught instanceof ClientApiError && caught.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(caught instanceof ClientApiError ? caught.message : "Could not load the tag.");
      }
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  const loadSidePanels = useCallback(async () => {
    setUsageLoading(true);
    // Each panel degrades on its own: a missing history must not blank out the
    // usage counts, and neither should keep the form from rendering.
    const [usageResult, listResult, historyResult] = await Promise.allSettled([
      fetchTagUsage(tagId),
      fetchTags(),
      fetchTagAudit(tagId),
    ]);

    setUsage(usageResult.status === "fulfilled" ? usageResult.value : null);
    setUsageLoading(false);
    setSiblings(listResult.status === "fulfilled" ? listResult.value : []);
    // `audit.read` is a separate permission from editing tags, so a 403 here
    // means "no history panel", not "something broke".
    setHistory(historyResult.status === "fulfilled" ? historyResult.value : null);
  }, [tagId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSidePanels();
  }, [loadSidePanels]);

  const trimmedTitle = title.trim();
  const nextSlug = slugifyTagTitle(trimmedTitle);
  const titleChanged = tag !== null && trimmedTitle !== tag.title;
  const dirty =
    tag !== null &&
    (titleChanged ||
      description.trim() !== (tag.description ?? "") ||
      visibility !== tag.visibility);
  const canSave = dirty && trimmedTitle !== "" && nextSlug !== "" && !saving;

  const similar = useMemo(
    () => (tag === null ? [] : findNearDuplicates(siblings, tag.title, tag.id)),
    [siblings, tag],
  );

  async function save() {
    if (!tag) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateTag(tag.id, {
        title: trimmedTitle,
        description: description.trim(),
        visibility,
      });
      setTag(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setVisibility(updated.visibility);
      setNotice("Saved everywhere this tag is attached.");
      void loadSidePanels();
    } catch (caught) {
      setSaveError(caught instanceof ClientApiError ? caught.message : "Could not save the tag.");
    } finally {
      setSaving(false);
      setPendingRename(false);
    }
  }

  /** A rename is global, so it asks. A description or visibility edit is not. */
  function submit() {
    if (!canSave) return;
    if (titleChanged) {
      setPendingRename(true);
      return;
    }
    void save();
  }

  async function confirmDelete() {
    if (!tag) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTag(tag.id);
      router.push(TAGS_HREF);
    } catch (caught) {
      setDeleteError(
        caught instanceof ClientApiError ? caught.message : "Could not delete the tag.",
      );
      setDeleting(false);
    }
  }

  async function submitMerge(input: { sourceTagIds: string[]; targetTagId: string }) {
    setMergeBusy(true);
    setMergeError(null);
    try {
      const result = await mergeTags(input);
      setMergeWith(null);
      // If this tag was the one folded away, its page no longer exists.
      if (input.sourceTagIds.includes(tagId)) {
        router.push(`${TAGS_HREF}?created=${encodeURIComponent(result.targetTagId)}`);
        return;
      }
      const moved = result.movedCourses + result.movedLessons;
      setNotice(
        moved === 0
          ? "Tags merged. Nothing needed moving."
          : `Tags merged. ${String(moved)} ${moved === 1 ? "attachment" : "attachments"} moved onto this tag.`,
      );
      await load();
      void loadSidePanels();
    } catch (caught) {
      setMergeError(
        caught instanceof ClientApiError ? caught.message : "Could not merge those tags.",
      );
    } finally {
      setMergeBusy(false);
    }
  }

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(
      () => {
        setNotice(`Copied ${label}.`);
      },
      () => {
        setNotice(null);
      },
    );
  }

  if (loading) return <TagDetailSkeleton />;

  if (notFound) {
    return (
      <div className={tagEmptyPanelClassName}>
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-bold text-[var(--admin-on-surface)]">
          That tag no longer exists
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          It may have been deleted, or merged into another tag. Either way the link that brought you
          here is stale.
        </p>
        <Link href={TAGS_HREF} className={`${managePrimaryButtonClassName} mt-6`}>
          Back to tags
        </Link>
      </div>
    );
  }

  if (loadError !== null || tag === null) {
    return (
      <div className="space-y-4">
        <p role="alert" className={tagInlineErrorClassName}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {loadError ?? "Could not load the tag."}
        </p>
        <button
          type="button"
          className={manageSecondaryButtonClassName}
          onClick={() => {
            void load();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
        <span className="truncate font-semibold text-[var(--admin-on-surface)]">{tag.title}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={managePageTitleClassName}>{tag.title}</h1>
            <span className={visibilityChipClassName(tag.visibility)}>
              {visibilityLabel(tag.visibility)}
            </span>
          </div>
          <p className={`${tagSlugClassName} mt-1`}>
            {tag.slug}
            <button
              type="button"
              aria-label={`Copy slug ${tag.slug}`}
              className="rounded p-0.5 transition-colors hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
              onClick={() => {
                copy(tag.slug, "slug");
              }}
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            onClick={() => {
              copy(tag.id, "tag ID");
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy tag ID
          </button>
          <button
            type="button"
            className={manageDangerButtonClassName}
            onClick={() => {
              setPendingDelete(true);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete tag
          </button>
          <button
            type="button"
            className={managePrimaryButtonClassName}
            disabled={!canSave}
            onClick={submit}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            Save changes
          </button>
        </div>
      </div>

      <div className={tagNoteClassName}>
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">
          Tags are shared. Renaming or deleting one changes it everywhere it is attached.
        </p>
      </div>

      {dirty ? (
        <p className="text-sm font-medium text-[var(--admin-warning)]">
          Unsaved changes. Nothing is applied until you save.
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-success)]"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <form
            className={`${panelClassName} space-y-5 p-6`}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            noValidate
          >
            {saveError ? (
              <p role="alert" className={tagInlineErrorClassName}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {saveError}
              </p>
            ) : null}

            <TagTitleField
              id={`${fieldId}-title`}
              value={title}
              disabled={saving}
              onChange={setTitle}
            />
            <TagDescriptionField
              id={`${fieldId}-description`}
              value={description}
              disabled={saving}
              rows={4}
              onChange={setDescription}
            />
            <TagVisibilityField value={visibility} disabled={saving} onChange={setVisibility} />
            <TagSlugPreview
              slug={nextSlug}
              caption={
                nextSlug !== tag.slug ? (
                  <span className="text-[var(--admin-warning)]">
                    Saving changes the slug from “{tag.slug}” to “{nextSlug}”. Anything referring to
                    the old slug will stop matching.
                  </span>
                ) : (
                  "Derived from the title. It cannot be set directly."
                )
              }
            />
            {/* The header carries the primary action; this keeps the form
                submittable from the keyboard without a second visible button. */}
            <button type="submit" className="sr-only" disabled={!canSave}>
              Save changes
            </button>
          </form>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Metadata</h2>
            </div>
            <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              <MetaRow label="Slug">
                <span className="font-data text-xs text-[var(--admin-on-surface)]">{tag.slug}</span>
              </MetaRow>
              <MetaRow label="Tag ID">
                <button
                  type="button"
                  className="font-data inline-flex items-center gap-1 text-xs text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                  aria-label="Copy tag ID"
                  onClick={() => {
                    copy(tag.id, "tag ID");
                  }}
                >
                  {/* The full uuid, not a truncated fragment: a fragment is not
                      the value anyone pasting it needs. */}
                  {tag.id}
                  <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
              </MetaRow>
              <MetaRow label="Created">
                <span className="text-sm text-[var(--admin-on-surface)]">
                  {formatTagRelative(tag.createdAt)}
                </span>
                <span className="font-data block text-[11px] text-[var(--admin-on-surface-variant)]">
                  {formatTagTimestamp(tag.createdAt)}
                </span>
              </MetaRow>
              <MetaRow label="Updated">
                <span className="text-sm text-[var(--admin-on-surface)]">
                  {formatTagRelative(tag.updatedAt)}
                </span>
                <span className="font-data block text-[11px] text-[var(--admin-on-surface-variant)]">
                  {formatTagTimestamp(tag.updatedAt)}
                </span>
              </MetaRow>
            </dl>
          </section>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
                Where this tag is used
              </h2>
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                {usageLoading ? "Counting attachments…" : usageLabel(usage?.counts)}
              </p>
            </div>

            <div className="p-4">
              {usageLoading ? (
                <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  Looking up attachments…
                </p>
              ) : usage === null ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Attachments could not be counted just now.
                </p>
              ) : usage.counts.courses + usage.counts.lessons === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Not attached to anything. Deleting it changes nothing learners can see.
                </p>
              ) : (
                <div className="space-y-4">
                  {usage.counts.courses > 0 ? (
                    <UsageGroup
                      icon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
                      heading={`${String(usage.counts.courses)} ${
                        usage.counts.courses === 1 ? "course" : "courses"
                      }`}
                      items={usage.courses.map((course) => ({
                        id: course.id,
                        primary: course.title,
                        secondary: course.status.toLowerCase(),
                      }))}
                    />
                  ) : null}
                  {usage.counts.lessons > 0 ? (
                    <UsageGroup
                      icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                      heading={`${String(usage.counts.lessons)} ${
                        usage.counts.lessons === 1 ? "lesson" : "lessons"
                      }`}
                      items={usage.lessons.map((lesson) => ({
                        id: lesson.id,
                        primary: lesson.title,
                        secondary: `in ${lesson.courseTitle}`,
                      }))}
                    />
                  ) : null}
                  {usage.truncated ? (
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      The counts are exact. The lists show the first 25 of each.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Similar tags</h2>
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                Near-duplicates split the same idea across two labels.
              </p>
            </div>
            {similar.length === 0 ? (
              <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                No similar tags found.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {similar.map((other) => (
                  <li key={other.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`${TAGS_HREF}/${other.id}`}
                          className="text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
                        >
                          {other.title}
                        </Link>
                        <span className={visibilityChipClassName(other.visibility)}>
                          {visibilityLabel(other.visibility)}
                        </span>
                      </div>
                      <span className={`${tagSlugClassName} mt-0.5`}>{other.slug}</span>
                      <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                        {usageLabel(other.usage)}
                      </span>
                    </div>
                    {/* Flagging a near-duplicate with no way to resolve it is a
                        dead end, so the resolution sits on the flag. */}
                    <button
                      type="button"
                      className={manageSecondaryButtonClassName}
                      onClick={() => {
                        setMergeError(null);
                        setMergeWith(other);
                      }}
                    >
                      <Combine className="h-4 w-4" aria-hidden="true" />
                      Merge
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface)]">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                Recent activity
              </h2>
            </div>
            {history === null ? (
              <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                {/* Reading the audit log is its own permission, so this is a
                    statement about access, not about the tag. */}
                Activity is not available with your permissions.
              </p>
            ) : history.length === 0 ? (
              <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
                Nothing recorded for this tag yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-baseline justify-between gap-3 px-4 py-2"
                  >
                    <span className="text-sm text-[var(--admin-on-surface)]">
                      {tagAuditActionLabel(entry.action)}
                    </span>
                    <span
                      className="font-data shrink-0 text-[11px] text-[var(--admin-on-surface-variant)]"
                      title={formatTagTimestamp(entry.occurredAt)}
                    >
                      {formatTagRelative(entry.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {history !== null ? (
              <p className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                {/* This list deliberately does not name an actor: the audit
                    reader returns a membership id, and rendering a raw id would
                    be worse than sending the reader where the names are. */}
                <Link
                  href="/admin/audit"
                  className="underline-offset-2 transition-colors hover:text-[var(--admin-primary)] hover:underline"
                >
                  The full audit log
                </Link>{" "}
                records who made each change.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <AdminConfirmDialog
        open={pendingRename}
        title="Rename this tag everywhere?"
        description={
          <>
            “{tag.title}” becomes “{trimmedTitle}” on every course and lesson it is attached to.{" "}
            <strong className="text-[var(--admin-on-surface)]">
              {usage
                ? usage.counts.courses + usage.counts.lessons === 0
                  ? "It is not attached to anything."
                  : `Right now that is ${usageLabel(usage.counts)}.`
                : ""}
            </strong>
          </>
        }
        confirmLabel="Rename tag"
        busyLabel="Renaming…"
        cancelLabel="Cancel"
        icon={Pencil}
        tone="primary"
        busy={saving}
        onConfirm={() => {
          void save();
        }}
        onCancel={() => {
          setPendingRename(false);
        }}
      />

      <AdminConfirmDialog
        open={pendingDelete}
        title="Delete tag?"
        description={
          <>
            Delete “{tag.title}”? It is removed from every course and lesson it is attached to.{" "}
            <strong className="text-[var(--admin-on-surface)]">
              {usage
                ? usage.counts.courses + usage.counts.lessons === 0
                  ? "It is not attached to anything."
                  : `Right now that is ${usageLabel(usage.counts)}.`
                : "Its attachments could not be counted just now."}
            </strong>{" "}
            <span className="text-[var(--admin-on-surface-variant)]">
              This cannot be undone, and the tag would have to be recreated by hand.
            </span>
          </>
        }
        confirmLabel="Delete tag"
        busyLabel="Deleting…"
        cancelLabel="Keep tag"
        icon={Trash2}
        tone="danger"
        busy={deleting}
        error={deleteError}
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => {
          setPendingDelete(false);
          setDeleteError(null);
        }}
      />

      <TagMergeDialog
        open={mergeWith !== null}
        candidates={mergeWith ? [tag, mergeWith] : null}
        busy={mergeBusy}
        error={mergeError}
        onSubmit={(input) => {
          void submitMerge(input);
        }}
        onCancel={() => {
          setMergeWith(null);
          setMergeError(null);
        }}
      />
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        {label}
      </dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}

function UsageGroup({
  icon,
  heading,
  items,
}: {
  icon: React.ReactNode;
  heading: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        {icon}
        {heading}
      </h3>
      <ul className="divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)]">
        {items.map((item) => (
          <li key={item.id} className="px-3 py-2">
            <span className="block truncate text-sm text-[var(--admin-on-surface)]">
              {item.primary}
            </span>
            <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
              {item.secondary}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagDetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-3 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-3 w-32 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="h-16 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="h-80 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-40 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="space-y-5 lg:col-span-5">
          <div className="h-52 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-40 rounded-xl bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
