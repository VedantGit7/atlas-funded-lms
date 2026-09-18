"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Combine,
  Loader2,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePageDescClassName,
  managePageTitleClassName,
  manageDangerButtonClassName,
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { TAG_MERGE_SOURCE_LIMIT, fetchTags, mergeTags, type Tag } from "./tags-api";
import {
  findDuplicateGroups,
  suggestSurvivor,
  tagCheckboxClassName,
  tagCountChipClassName,
  tagEmptyPanelClassName,
  tagInlineErrorClassName,
  tagNoteClassName,
  tagSlugClassName,
  totalUsage,
  usageLabel,
  visibilityChipClassName,
  visibilityLabel,
} from "./tags-shared";
import { TagsErrorState } from "./TagsStates";

const TAGS_HREF = "/admin/manage/tags";

const panelClassName =
  "flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";
const panelHeaderClassName =
  "flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3";

/**
 * `/admin/manage/tags/merge`.
 *
 * The design brief for this screen led with a capability strip announcing that
 * merging did not exist — "The API can create, rename and delete a tag, but it
 * cannot move attachments from one tag to another" — and drew the working
 * version only as a reference "for when merging exists". It exists;
 * `POST /api/v1/tags/merge` moves the attachments and deletes the sources in
 * one transaction. So the strip is gone and the reference is the screen.
 *
 * One thing the reference implied that the endpoint could not do is folding
 * several tags at once, which is the normal case — a drifted vocabulary carries
 * "Beginner", "beginners" and "Beginner's guide" together. Looping pairwise
 * calls from here would leave a half-merged vocabulary behind the first
 * failure, so the endpoint takes a list.
 */
export function AdminTagMergePage() {
  const router = useRouter();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [survivorId, setSurvivorId] = useState<string | null>(null);

  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTags(await fetchTags());
    } catch (caught) {
      setTags([]);
      setError(caught instanceof ClientApiError ? caught.message : "Could not load tags.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => findDuplicateGroups(tags), [tags]);

  const selected = useMemo(
    () => tags.filter((tag) => selectedIds.has(tag.id)),
    [tags, selectedIds],
  );

  // The survivor is only ever one of the selected tags. Clearing a stale choice
  // here rather than at each click means deselecting the survivor cannot leave
  // the footer naming a tag that is no longer in the merge.
  const survivor = useMemo<Tag | null>(
    () => selected.find((tag) => tag.id === survivorId) ?? suggestSurvivor(selected),
    [selected, survivorId],
  );

  const sources = useMemo(
    () => selected.filter((tag) => tag.id !== survivor?.id),
    [selected, survivor],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched =
      needle === ""
        ? tags
        : tags.filter(
            (tag) =>
              tag.title.toLowerCase().includes(needle) || tag.slug.toLowerCase().includes(needle),
          );
    return [...matched].sort((a, b) => a.title.localeCompare(b.title));
  }, [tags, search]);

  const overLimit = sources.length > TAG_MERGE_SOURCE_LIMIT;
  const canMerge = survivor !== null && sources.length > 0 && !overLimit && !merging;
  const movedTotal = sources.reduce((total, tag) => total + totalUsage(tag), 0);

  function toggle(tagId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function selectGroup(group: Tag[]) {
    setSelectedIds(new Set(group.map((tag) => tag.id)));
    setSurvivorId(suggestSurvivor(group)?.id ?? null);
    setMergeError(null);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSurvivorId(null);
    setMergeError(null);
  }

  async function runMerge() {
    // `canMerge` already asserts a survivor, and TypeScript narrows through the
    // alias, so a second null check here would be unreachable.
    if (!canMerge) return;
    setMerging(true);
    setMergeError(null);
    try {
      const result = await mergeTags({
        sourceTagIds: sources.map((tag) => tag.id),
        targetTagId: survivor.id,
      });
      // Land on the survivor's row in the list, highlighted, so the operator
      // sees the tag that remains rather than a page of tags that vanished.
      router.push(`${TAGS_HREF}?created=${encodeURIComponent(result.targetTagId)}`);
    } catch (caught) {
      setMergeError(
        caught instanceof ClientApiError ? caught.message : "Could not merge those tags.",
      );
      setMerging(false);
    }
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
        <span className="font-semibold text-[var(--admin-on-surface)]">Merge</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className={managePageTitleClassName}>Merge tags</h1>
          <p className={managePageDescClassName}>
            Fold duplicate tags into one without losing where they are attached.
          </p>
        </div>
        <Link href={TAGS_HREF} className={manageSecondaryButtonClassName}>
          Back to tags
        </Link>
      </div>

      <div className={tagNoteClassName}>
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">
          Merged tags are deleted. Every course and lesson attached to them keeps its tagging, moved
          onto the tag you keep — but the folded tags cannot be recovered.
        </p>
      </div>

      {error ? (
        <TagsErrorState
          message={error}
          retrying={loading}
          onRetry={() => {
            void load();
          }}
        />
      ) : null}

      {!error ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <section className={panelClassName}>
              <div className={panelHeaderClassName}>
                <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Tags to merge</h2>
                <span className={tagCountChipClassName}>{String(selected.length)} selected</span>
              </div>

              <div className="border-b border-[var(--admin-border)] p-3">
                <div className="relative">
                  <label className="sr-only" htmlFor="merge-search">
                    Search tags
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    id="merge-search"
                    type="search"
                    className={manageSearchInputClassName}
                    placeholder="Search tags…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                    }}
                  />
                </div>
              </div>

              {loading ? (
                <MergeListSkeleton />
              ) : visible.length === 0 ? (
                <p className="p-6 text-sm text-[var(--admin-on-surface-variant)]">
                  No tags match “{search.trim()}”.
                </p>
              ) : (
                <ul className="max-h-[26rem] divide-y divide-[var(--admin-border)] overflow-y-auto">
                  {visible.map((tag) => {
                    const isSelected = selectedIds.has(tag.id);
                    const isSurvivor = survivor?.id === tag.id;
                    return (
                      <li key={tag.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--admin-surface-high)]">
                          <input
                            type="checkbox"
                            className={tagCheckboxClassName}
                            checked={isSelected}
                            onChange={() => {
                              toggle(tag.id);
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
                              {isSurvivor ? (
                                <span className="font-data rounded-md border border-[color-mix(in_srgb,var(--admin-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-success)]">
                                  Keeping
                                </span>
                              ) : null}
                            </span>
                            <span className={`${tagSlugClassName} mt-0.5`}>{tag.slug}</span>
                          </span>
                          <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">
                            {usageLabel(tag.usage)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {selected.length > 1 ? (
              <section className={panelClassName}>
                <div className={panelHeaderClassName}>
                  <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
                    Which tag survives?
                  </h2>
                  <button
                    type="button"
                    className={manageSecondaryButtonClassName}
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear
                  </button>
                </div>
                <fieldset className="divide-y divide-[var(--admin-border)]" disabled={merging}>
                  <legend className="sr-only">Choose the surviving tag</legend>
                  {selected.map((tag) => (
                    <label
                      key={tag.id}
                      className={[
                        "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
                        survivor?.id === tag.id
                          ? "bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)]"
                          : "hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="tag-merge-survivor"
                        className="mt-1 h-4 w-4 accent-[var(--admin-primary)]"
                        checked={survivor?.id === tag.id}
                        onChange={() => {
                          setSurvivorId(tag.id);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          {tag.title}
                        </span>
                        <span className={`${tagSlugClassName} mt-0.5`}>{tag.slug}</span>
                        <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                          {usageLabel(tag.usage)} ·{" "}
                          {tag.description ? tag.description : "No description"}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                  Only attachments move. The survivor keeps its own title, slug, description and
                  visibility; the folded tags lose theirs.
                </p>
              </section>
            ) : null}
          </div>

          <div className="space-y-5 xl:col-span-5">
            <section className={panelClassName}>
              <div className={panelHeaderClassName}>
                <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">
                  Possible duplicates
                </h2>
                <button
                  type="button"
                  aria-label="Rescan"
                  className={manageSecondaryButtonClassName}
                  disabled={loading}
                  onClick={() => {
                    void load();
                  }}
                >
                  <RotateCcw
                    className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  Rescan
                </button>
              </div>

              {loading ? (
                <MergeListSkeleton rows={3} />
              ) : groups.length === 0 ? (
                <div className={`${tagEmptyPanelClassName} border-0 py-12`}>
                  <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-bold text-[var(--admin-on-surface)]">
                    No obvious duplicates
                  </h3>
                  <p className="mt-2 max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
                    Nothing in this vocabulary differs only by case, spacing or a plural. You can
                    still pick any two tags on the left and merge them.
                  </p>
                </div>
              ) : (
                <div className="max-h-[34rem] space-y-4 overflow-y-auto p-4">
                  {groups.map((group) => (
                    <div key={group.key} className="rounded-lg border border-[var(--admin-border)]">
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] px-3 py-2">
                        <span className="font-data text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          {group.reason}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[var(--admin-primary)] underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                          onClick={() => {
                            selectGroup(group.tags);
                          }}
                        >
                          Select these {String(group.tags.length)}
                        </button>
                      </div>
                      <ul className="divide-y divide-[var(--admin-border)]">
                        {group.tags.map((tag) => (
                          <li
                            key={tag.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="min-w-0">
                              <Link
                                href={`${TAGS_HREF}/${tag.id}`}
                                className="block truncate text-sm text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
                              >
                                {tag.title}
                              </Link>
                              <span className={tagSlugClassName}>{tag.slug}</span>
                            </span>
                            <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">
                              {usageLabel(tag.usage)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {!loading ? (
                <p className="border-t border-[var(--admin-border)] px-4 py-2 text-center text-xs text-[var(--admin-on-surface-variant)]">
                  {groups.length === 0
                    ? `${String(tags.length)} tags scanned`
                    : `${String(groups.length)} ${
                        groups.length === 1 ? "group" : "groups"
                      } across ${String(tags.length)} tags`}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      {/* The effect preview and the action live together at the bottom: the
          sentence describing what will happen is the last thing read before the
          button that does it. */}
      {selected.length > 0 && !error ? (
        <section className="admin-glass sticky bottom-4 z-20 space-y-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] px-4 py-4 motion-safe:animate-[admin-banner-in_0.18s_ease-out]">
          {mergeError ? (
            <p role="alert" className={tagInlineErrorClassName}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {mergeError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-[var(--admin-on-surface)]">
              {sources.length === 0 ? (
                <>Select at least one more tag to merge into “{survivor?.title ?? ""}”.</>
              ) : (
                <>
                  <strong className="font-semibold">
                    {String(sources.length)} {sources.length === 1 ? "tag" : "tags"}
                  </strong>{" "}
                  fold into{" "}
                  <ArrowRight
                    className="inline h-3.5 w-3.5 text-[var(--admin-primary)]"
                    aria-hidden="true"
                  />{" "}
                  <strong className="font-semibold">“{survivor?.title ?? ""}”</strong>.{" "}
                  <span className="text-[var(--admin-on-surface-variant)]">
                    {movedTotal === 0
                      ? "None of them is attached to anything, so nothing moves."
                      : `Up to ${String(movedTotal)} ${
                          movedTotal === 1 ? "attachment" : "attachments"
                        } move onto it; anything already carrying “${
                          survivor?.title ?? ""
                        }” simply keeps it.`}
                  </span>
                </>
              )}
            </p>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                disabled={merging}
                onClick={clearSelection}
              >
                Cancel
              </button>
              <button
                type="button"
                className={manageDangerButtonClassName}
                disabled={!canMerge}
                onClick={() => {
                  void runMerge();
                }}
              >
                {merging ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <Combine className="h-4 w-4" aria-hidden="true" />
                )}
                {merging
                  ? "Merging…"
                  : `Merge ${String(sources.length)} into “${survivor?.title ?? ""}”`}
              </button>
            </div>
          </div>

          {overLimit ? (
            <p role="alert" className="text-xs font-semibold text-[var(--admin-danger)]">
              At most {String(TAG_MERGE_SOURCE_LIMIT)} tags can be folded in one merge. Deselect
              some and run it again.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MergeListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="h-4 w-4 shrink-0 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div
              className="h-3.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              style={{ width: `${String(35 + ((index * 13) % 30))}%` }}
            />
            <div
              className="h-2.5 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
              style={{ width: `${String(20 + ((index * 7) % 15))}%` }}
            />
          </div>
          <div className="h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
