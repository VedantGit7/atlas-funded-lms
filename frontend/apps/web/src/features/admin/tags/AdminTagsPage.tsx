"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  Combine,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
  manageSearchInputClassName,
} from "../manage/manage-ui-shared";
import {
  TAG_BULK_LIMIT,
  TAG_VISIBILITIES,
  bulkTagAction,
  deleteTag,
  fetchTag,
  fetchTagUsage,
  fetchTags,
  mergeTags,
  updateTag,
  type Tag,
  type TagUsageDetail,
  type TagVisibility,
} from "./tags-api";
import {
  TAG_SORTS,
  findDuplicateIds,
  groupKeyFor,
  sortTags,
  tagBulkBarClassName,
  tagBulkButtonClassName,
  tagBulkDangerButtonClassName,
  tagCountChipClassName,
  tagCheckboxClassName,
  tagDangerIconButtonClassName,
  tagFooterNoteClassName,
  tagGroupHeadingClassName,
  tagIconButtonClassName,
  tagInlineErrorClassName,
  tagNoteClassName,
  tagRowClassName,
  tagRowHighlightClassName,
  tagRowSelectedClassName,
  tagSegmentActiveClassName,
  tagSegmentClassName,
  tagSegmentedGroupClassName,
  tagSlugClassName,
  tagTableHeadCellClassName,
  tagTableShellClassName,
  tagToolbarClassName,
  toCsv,
  usageLabel,
  visibilityChipClassName,
  visibilityLabel,
  type TagSort,
} from "./tags-shared";
import { TagEditorPanel, type TagEditorValues } from "./TagEditorPanel";
import { TagMergeDialog } from "./TagMergeDialog";
import { TagUsageDialog } from "./TagUsageDialog";
import { TagsEmptyState, TagsErrorState, TagsNoMatchState, TagsSkeleton } from "./TagsStates";

type VisibilityFilter = TagVisibility | "all";

const VISIBILITY_FILTERS: ReadonlyArray<{ value: VisibilityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
  { value: "classification", label: "Classification" },
];

/**
 * Tenant-wide tag administration.
 *
 * A small screen with a large blast radius: a tag is one shared record, so
 * renaming it renames it on every course and lesson at once and deleting it
 * removes it from all of them. Three things follow from that, and all three are
 * load-bearing rather than decorative.
 *
 * **The scope note is permanent**, not a toast — an admin who has scrolled past
 * it still needs it true.
 *
 * **Every mutation names its blast radius.** The delete confirmation reads the
 * live attachment count before it asks; the module used to say the console
 * could not know it, which was true of the API and never of the database.
 *
 * **All three visibility values are offered.** The shipped panel offered two
 * uppercase ones, so a tag stored as `classification` could not be edited
 * without being silently reassigned, and every save sent a value the server's
 * enum rejects.
 *
 * The list is deliberately unpaginated — the endpoint returns a bare items
 * array — so search, filter, sort and grouping all happen here over the full
 * set, and the footer says so rather than drawing a paginator that would lie.
 */
export function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [sort, setSort] = useState<TagSort>("title-asc");
  const [sortOpen, setSortOpen] = useState(false);
  const [grouped, setGrouped] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<TagEditorValues | null>(null);
  const [editSlug, setEditSlug] = useState<string>("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingRename, setPendingRename] = useState<TagEditorValues | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<TagUsageDetail | null>(null);
  const [deleteUsageLoading, setDeleteUsageLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // The create route redirects back with the new tag's id so the list can
  // point at where it landed alphabetically, rather than leaving the operator
  // to hunt for it among sixty others.
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const [usageTag, setUsageTag] = useState<Tag | null>(null);
  const [usageData, setUsageData] = useState<TagUsageDetail | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      setTags(await fetchTags());
    } catch (caught) {
      setTags([]);
      setError(caught instanceof ClientApiError ? caught.message : "Could not load tags.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  // The id is consumed once and stripped from the URL: a refresh or a shared
  // link should not re-announce a tag created ten minutes ago.
  useEffect(() => {
    if (createdId === null) return;
    setHighlightId(createdId);
    router.replace("/admin/manage/tags");
  }, [createdId, router]);

  useEffect(() => {
    if (highlightId === null || loading) return;
    highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, loading, tags]);

  const highlightedTag = useMemo(
    () => (highlightId === null ? null : (tags.find((tag) => tag.id === highlightId) ?? null)),
    [tags, highlightId],
  );

  const duplicateIds = useMemo(() => findDuplicateIds(tags), [tags]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = tags.filter((tag) => {
      if (visibilityFilter !== "all" && tag.visibility !== visibilityFilter) return false;
      if (needle === "") return true;
      return (
        tag.title.toLowerCase().includes(needle) ||
        tag.slug.toLowerCase().includes(needle) ||
        (tag.description ?? "").toLowerCase().includes(needle)
      );
    });
    return sortTags(filtered, sort);
  }, [tags, search, visibilityFilter, sort]);

  // Grouping by first letter only means something while the list is sorted by
  // name; under "most used" the headings would repeat letters out of order, so
  // the toggle is disabled rather than producing a nonsense outline.
  const groupingAvailable = sort === "title-asc" || sort === "title-desc";
  const showGroups = grouped && groupingAvailable && visible.length > 0;

  const selectedTags = useMemo(
    () => visible.filter((tag) => selectedIds.has(tag.id)),
    [visible, selectedIds],
  );

  const allVisibleSelected = visible.length > 0 && visible.every((tag) => selectedIds.has(tag.id));

  function markBusy(tagId: string, busy: boolean) {
    setBusyIds((previous) => {
      const next = new Set(previous);
      if (busy) next.add(tagId);
      else next.delete(tagId);
      return next;
    });
  }

  function setRowError(tagId: string, message: string | null) {
    setRowErrors((previous) => {
      const next = new Map(previous);
      if (message === null) next.delete(tagId);
      else next.set(tagId, message);
      return next;
    });
  }

  function toggleRow(tagId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visible.map((tag) => tag.id)));
  }

  function clearFilters() {
    setSearch("");
    setVisibilityFilter("all");
  }

  function copySlug(slug: string) {
    void navigator.clipboard.writeText(slug).then(
      () => {
        setNotice(`Copied “${slug}”.`);
      },
      () => {
        setNotice(null);
      },
    );
  }

  /**
   * Re-reads the tag before opening the form, so an edit never starts from a
   * row that has since changed. A failed read shows an error on that row rather
   * than opening an empty form the operator would then save over the real one.
   */
  async function startEdit(tag: Tag) {
    setEditError(null);
    setRowError(tag.id, null);
    markBusy(tag.id, true);
    try {
      const detail = await fetchTag(tag.id);
      setEditingId(detail.id);
      setEditSlug(detail.slug);
      setEditInitial({
        title: detail.title,
        description: detail.description ?? "",
        visibility: detail.visibility,
      });
    } catch (caught) {
      setRowError(
        tag.id,
        caught instanceof ClientApiError ? caught.message : "Could not open that tag.",
      );
    } finally {
      markBusy(tag.id, false);
    }
  }

  function closeEditor() {
    setEditingId(null);
    setEditInitial(null);
    setEditSlug("");
    setEditError(null);
    setPendingRename(null);
  }

  async function saveEdit(values: TagEditorValues) {
    if (!editingId) return;
    setEditBusy(true);
    setEditError(null);
    markBusy(editingId, true);
    try {
      await updateTag(editingId, values);
      closeEditor();
      setNotice(`“${values.title}” updated everywhere it is attached.`);
      await load("refresh");
    } catch (caught) {
      setEditError(caught instanceof ClientApiError ? caught.message : "Could not save the tag.");
    } finally {
      setEditBusy(false);
      markBusy(editingId, false);
      setPendingRename(null);
    }
  }

  /** A rename is global, so it asks; a description or visibility edit is not. */
  function submitEdit(values: TagEditorValues) {
    if (editInitial && values.title !== editInitial.title) {
      setPendingRename(values);
      return;
    }
    void saveEdit(values);
  }

  /**
   * Opens the delete confirmation and, in parallel, reads how much the delete
   * would actually touch. The dialog opens immediately rather than waiting: the
   * count sharpens the question, it does not gate it.
   */
  function askDelete(tag: Tag) {
    setPendingDelete(tag);
    setDeleteError(null);
    setDeleteUsage(null);
    setDeleteUsageLoading(true);
    void fetchTagUsage(tag.id)
      .then((usage) => {
        setDeleteUsage(usage);
      })
      .catch(() => {
        setDeleteUsage(null);
      })
      .finally(() => {
        setDeleteUsageLoading(false);
      });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const tag = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    markBusy(tag.id, true);
    try {
      await deleteTag(tag.id);
      if (editingId === tag.id) closeEditor();
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(tag.id);
        return next;
      });
      setPendingDelete(null);
      setNotice(`“${tag.title}” deleted.`);
      await load("refresh");
    } catch (caught) {
      setDeleteError(
        caught instanceof ClientApiError ? caught.message : "Could not delete the tag.",
      );
    } finally {
      setDeleting(false);
      markBusy(tag.id, false);
    }
  }

  function openUsage(tag: Tag) {
    setUsageTag(tag);
    setUsageData(null);
    setUsageError(null);
    setUsageLoading(true);
    void fetchTagUsage(tag.id)
      .then((usage) => {
        setUsageData(usage);
      })
      .catch((caught: unknown) => {
        setUsageError(
          caught instanceof ClientApiError
            ? caught.message
            : "Could not look up where this tag is used.",
        );
      })
      .finally(() => {
        setUsageLoading(false);
      });
  }

  async function runBulk(
    input:
      | { action: "set_visibility"; tagIds: string[]; visibility: TagVisibility }
      | { action: "delete"; tagIds: string[] },
  ) {
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    setBusyIds(new Set(input.tagIds));
    try {
      const result = await bulkTagAction(input);
      setSelectedIds(new Set());
      if (result.updatedIds.length > 0) {
        const count = result.updatedIds.length;
        setNotice(
          input.action === "delete"
            ? `${String(count)} ${count === 1 ? "tag" : "tags"} deleted.`
            : `${String(count)} ${count === 1 ? "tag" : "tags"} set to ${visibilityLabel(
                input.visibility,
              ).toLowerCase()}.`,
        );
      }
      // A stale selection is the operator's to know about: those tags are gone
      // from under them and the count they just read would otherwise be wrong.
      if (result.missingIds.length > 0) {
        setError(
          `${String(result.missingIds.length)} ${
            result.missingIds.length === 1 ? "tag is" : "tags are"
          } no longer available and were skipped.`,
        );
      }
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not apply that to the selection.",
      );
    } finally {
      setBulkBusy(false);
      setBusyIds(new Set());
      setPendingBulkDelete(false);
    }
    await load("refresh");
  }

  async function submitMerge(input: { sourceTagIds: string[]; targetTagId: string }) {
    setMergeBusy(true);
    setMergeError(null);
    try {
      const result = await mergeTags(input);
      const moved = result.movedCourses + result.movedLessons;
      setMergeOpen(false);
      setSelectedIds(new Set());
      setNotice(
        moved === 0
          ? "Tags merged. Nothing needed moving."
          : `Tags merged. ${String(moved)} ${moved === 1 ? "attachment" : "attachments"} moved.`,
      );
      await load("refresh");
    } catch (caught) {
      setMergeError(
        caught instanceof ClientApiError ? caught.message : "Could not merge those tags.",
      );
    } finally {
      setMergeBusy(false);
    }
  }

  function exportVisible() {
    const chosen = selectedTags.length > 0 ? selectedTags : visible;
    const csv = toCsv(
      ["Title", "Slug", "Description", "Visibility", "Courses", "Lessons"],
      chosen.map((tag) => [
        tag.title,
        tag.slug,
        tag.description ?? "",
        visibilityLabel(tag.visibility),
        tag.usage?.courses ?? 0,
        tag.usage?.lessons ?? 0,
      ]),
    );

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tags-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${String(chosen.length)} ${chosen.length === 1 ? "tag" : "tags"}.`);
  }

  const sortLabel = TAG_SORTS.find((entry) => entry.value === sort)?.label ?? "Name (A–Z)";
  const mergeCandidates: [Tag, Tag] | null =
    selectedTags.length === 2 && selectedTags[0] && selectedTags[1]
      ? [selectedTags[0], selectedTags[1]]
      : null;

  let previousGroup = "";

  return (
    <div className="space-y-5">
      {/* The page title and description come from the Manage section shell, so
          this row carries only the actions. */}
      <div className="flex flex-wrap justify-end gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={loading || refreshing}
            onClick={() => {
              void load("refresh");
            }}
          >
            <RotateCcw
              className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <Link href="/admin/manage/tags/new" className={managePrimaryButtonClassName}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New tag
          </Link>
        </div>
      </div>

      {/* Permanent, never a toast: an admin who has scrolled past it still
          needs it to be true. */}
      <div className={tagNoteClassName}>
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--admin-on-surface)]">
          Tags are shared. Renaming or deleting one changes it everywhere it is attached.
        </p>
      </div>

      {notice ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-success)]">
          {notice}
        </p>
      ) : null}

      {/* Confirms the create landed and says where, since a new tag sorts into
          the middle of the list rather than appearing at the top. */}
      {highlightedTag ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-2 text-sm"
        >
          <Check className="h-4 w-4 shrink-0 text-[var(--admin-success)]" aria-hidden="true" />
          <span className="font-medium text-[var(--admin-success)]">
            “{highlightedTag.title}” created.
          </span>
          <span className="text-[var(--admin-on-surface-variant)]">
            It is highlighted below, in its alphabetical position.
          </span>
          <button
            type="button"
            className="ml-auto rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
            aria-label="Dismiss"
            onClick={() => {
              setHighlightId(null);
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={tagToolbarClassName}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <label className="sr-only" htmlFor="tag-search">
              Search tags
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              id="tag-search"
              type="search"
              className={manageSearchInputClassName}
              placeholder="Search title, slug or description"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>

          <div
            className={tagSegmentedGroupClassName}
            role="group"
            aria-label="Filter by visibility"
          >
            {VISIBILITY_FILTERS.map((entry, index) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={entry.value === visibilityFilter}
                className={[
                  tagSegmentClassName,
                  index > 0 ? "border-l border-[var(--admin-outline)]" : "",
                  entry.value === visibilityFilter ? tagSegmentActiveClassName : "",
                ].join(" ")}
                onClick={() => {
                  setVisibilityFilter(entry.value);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <DropdownField
              label={
                <span className="sr-only" id="tag-sort-label">
                  Sort tags
                </span>
              }
              labelId="tag-sort"
              open={sortOpen}
              panelAriaLabel="Sort tags"
              leftIcon={<ArrowUpDown className="h-4 w-4" aria-hidden="true" />}
              onToggle={() => {
                setSortOpen((previous) => !previous);
              }}
              triggerContent={sortLabel}
            >
              <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {TAG_SORTS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    role="option"
                    aria-selected={entry.value === sort}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setSort(entry.value);
                      setSortOpen(false);
                    }}
                  >
                    <span className="flex-1">{entry.label}</span>
                    {entry.value === sort ? (
                      <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <label
            className={`flex items-center gap-2 text-sm ${
              groupingAvailable
                ? "text-[var(--admin-on-surface)]"
                : "text-[var(--admin-on-surface-variant)]"
            }`}
            title={
              groupingAvailable
                ? undefined
                : "Alphabetical grouping only applies while the list is sorted by name."
            }
          >
            <input
              type="checkbox"
              className={tagCheckboxClassName}
              checked={grouped && groupingAvailable}
              disabled={!groupingAvailable}
              onChange={(event) => {
                setGrouped(event.target.checked);
              }}
            />
            Group alphabetically
          </label>

          <button
            type="button"
            className={manageSecondaryButtonClassName}
            disabled={visible.length === 0}
            onClick={exportVisible}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>

          {/* The bulk bar merges a pair in place; anything larger — a cluster of
              three spellings of the same idea — belongs on the merge screen. */}
          <Link href="/admin/manage/tags/merge" className={manageSecondaryButtonClassName}>
            <Combine className="h-4 w-4" aria-hidden="true" />
            Merge duplicates
          </Link>

          <span className={tagCountChipClassName}>
            {String(visible.length)} of {String(tags.length)} tags
          </span>
        </div>
      </div>

      {/* Counted from the visible rows, not from every checked id: a filter
          applied after selecting would otherwise show a count the bulk actions
          do not act on. */}
      {selectedTags.length > 0 ? (
        <div className={tagBulkBarClassName}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
              {String(selectedTags.length)} {selectedTags.length === 1 ? "tag" : "tags"} selected
            </p>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Bulk actions apply everywhere these tags are attached.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <DropdownField
                label={
                  <span className="sr-only" id="tag-bulk-visibility-label">
                    Set visibility
                  </span>
                }
                labelId="tag-bulk-visibility"
                open={bulkVisibilityOpen}
                disabled={bulkBusy}
                panelAriaLabel="Set visibility"
                onToggle={() => {
                  setBulkVisibilityOpen((previous) => !previous);
                }}
                triggerContent="Set visibility"
              >
                <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                  {TAG_VISIBILITIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={dropdownItemClassName}
                      onClick={() => {
                        setBulkVisibilityOpen(false);
                        void runBulk({
                          action: "set_visibility",
                          tagIds: selectedTags.slice(0, TAG_BULK_LIMIT).map((tag) => tag.id),
                          visibility: value,
                        });
                      }}
                    >
                      {visibilityLabel(value)}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <button
              type="button"
              className={tagBulkButtonClassName}
              disabled={bulkBusy || mergeCandidates === null}
              title={
                mergeCandidates === null
                  ? "Select exactly two tags to merge them here, or use Merge duplicates for a larger cluster."
                  : undefined
              }
              onClick={() => {
                setMergeError(null);
                setMergeOpen(true);
              }}
            >
              <Combine className="h-3.5 w-3.5" aria-hidden="true" />
              Merge
            </button>

            <button
              type="button"
              className={tagBulkDangerButtonClassName}
              disabled={bulkBusy}
              onClick={() => {
                setPendingBulkDelete(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>

            <button
              type="button"
              className={tagBulkButtonClassName}
              disabled={bulkBusy}
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <TagsErrorState
          message={error}
          retrying={refreshing}
          onRetry={() => {
            void load("refresh");
          }}
        />
      ) : null}

      {loading ? (
        <TagsSkeleton />
      ) : tags.length === 0 && !error ? (
        <TagsEmptyState createHref="/admin/manage/tags/new" />
      ) : visible.length === 0 && !error ? (
        <TagsNoMatchState
          query={search}
          matched={0}
          total={tags.length}
          onClearFilters={clearFilters}
        />
      ) : !error ? (
        <div className={tagTableShellClassName}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse text-sm">
              <caption className="sr-only">
                Tags in this academy, with where each one is attached.
              </caption>
              <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                <tr>
                  <th scope="col" className={`${tagTableHeadCellClassName} w-10`}>
                    <input
                      type="checkbox"
                      className={tagCheckboxClassName}
                      checked={allVisibleSelected}
                      aria-label={allVisibleSelected ? "Clear selection" : "Select all tags shown"}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th scope="col" className={tagTableHeadCellClassName}>
                    Tag name and slug
                  </th>
                  <th scope="col" className={tagTableHeadCellClassName}>
                    Description
                  </th>
                  <th scope="col" className={tagTableHeadCellClassName}>
                    Used by
                  </th>
                  <th scope="col" className={`${tagTableHeadCellClassName} w-36`}>
                    Visibility
                  </th>
                  <th scope="col" className={`${tagTableHeadCellClassName} w-24 text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tag) => {
                  const groupKey = groupKeyFor(tag);
                  const startsGroup = showGroups && groupKey !== previousGroup;
                  if (startsGroup) previousGroup = groupKey;
                  const isBusy = busyIds.has(tag.id);
                  const isSelected = selectedIds.has(tag.id);
                  const isHighlighted = tag.id === highlightId;
                  const rowError = rowErrors.get(tag.id);

                  return (
                    <Fragment key={tag.id}>
                      {startsGroup ? (
                        <tr>
                          <th scope="colgroup" colSpan={6} className={tagGroupHeadingClassName}>
                            {groupKey}
                          </th>
                        </tr>
                      ) : null}

                      <tr
                        ref={isHighlighted ? highlightRef : null}
                        className={[
                          tagRowClassName,
                          isSelected ? tagRowSelectedClassName : "",
                          isHighlighted ? tagRowHighlightClassName : "",
                          isBusy ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 align-top">
                          <input
                            type="checkbox"
                            className={tagCheckboxClassName}
                            checked={isSelected}
                            aria-label={`Select ${tag.title}`}
                            onChange={() => {
                              toggleRow(tag.id);
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/manage/tags/${tag.id}`}
                              className="font-semibold text-[var(--admin-on-surface)] underline-offset-2 transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                            >
                              {tag.title}
                            </Link>
                            {duplicateIds.has(tag.id) ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--admin-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-warning)]"
                                title="Another tag has a very similar name. Select both and merge them if they mean the same thing."
                              >
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                Possible duplicate
                              </span>
                            ) : null}
                          </div>
                          <span className={tagSlugClassName}>
                            {tag.slug}
                            <button
                              type="button"
                              aria-label={`Copy slug ${tag.slug}`}
                              className="rounded p-0.5 opacity-0 transition-opacity hover:text-[var(--admin-primary)] focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                              onClick={() => {
                                copySlug(tag.slug);
                              }}
                            >
                              <Copy className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </span>
                          {rowError ? (
                            <p role="alert" className={`${tagInlineErrorClassName} mt-2`}>
                              <AlertTriangle
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              {rowError}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-xs px-4 py-3 align-top text-[var(--admin-on-surface-variant)]">
                          {tag.description ? (
                            <span className="line-clamp-2">{tag.description}</span>
                          ) : (
                            <span className="italic">No description</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            className="rounded text-left text-sm text-[var(--admin-on-surface-variant)] underline-offset-2 transition-colors hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                            onClick={() => {
                              openUsage(tag);
                            }}
                          >
                            {usageLabel(tag.usage)}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={visibilityChipClassName(tag.visibility)}>
                            {visibilityLabel(tag.visibility)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-end gap-1">
                            {isBusy ? (
                              <Loader2
                                className="h-4 w-4 text-[var(--admin-on-surface-variant)] motion-safe:animate-spin"
                                aria-label="Working"
                              />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={tagIconButtonClassName}
                                  aria-label={`Edit ${tag.title}`}
                                  onClick={() => {
                                    void startEdit(tag);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className={tagDangerIconButtonClassName}
                                  aria-label={`Delete ${tag.title}`}
                                  onClick={() => {
                                    askDelete(tag);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {editingId === tag.id && editInitial ? (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <TagEditorPanel
                              initial={editInitial}
                              currentSlug={editSlug}
                              busy={editBusy}
                              error={editError}
                              onSubmit={submitEdit}
                              onCancel={closeEditor}
                              onCopySlug={copySlug}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* The endpoint returns a bare items array — there is no cursor to
              page with, so saying so beats drawing a paginator that would lie. */}
          <p className={tagFooterNoteClassName}>All tags are shown. This list is not paginated.</p>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={pendingRename !== null}
        title="Rename this tag everywhere?"
        description={
          <>
            “{editInitial?.title ?? "This tag"}” becomes “{pendingRename?.title ?? ""}” on every
            course and lesson it is attached to.
          </>
        }
        confirmLabel="Rename tag"
        busyLabel="Renaming…"
        cancelLabel="Cancel"
        icon={Pencil}
        tone="primary"
        busy={editBusy}
        onConfirm={() => {
          if (pendingRename) void saveEdit(pendingRename);
        }}
        onCancel={() => {
          setPendingRename(null);
        }}
      />

      <AdminConfirmDialog
        open={pendingDelete !== null}
        title="Delete tag?"
        description={
          <>
            Delete “{pendingDelete?.title ?? "this tag"}”? It is removed from every course and
            lesson it is attached to.{" "}
            {deleteUsageLoading ? (
              <span className="text-[var(--admin-on-surface-variant)]">
                Checking where it is attached…
              </span>
            ) : deleteUsage ? (
              <strong className="text-[var(--admin-on-surface)]">
                {deleteUsage.counts.courses + deleteUsage.counts.lessons === 0
                  ? "It is not attached to anything."
                  : `Right now that is ${usageLabel(deleteUsage.counts)}.`}
              </strong>
            ) : (
              <span className="text-[var(--admin-on-surface-variant)]">
                Its attachments could not be counted just now.
              </span>
            )}
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
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />

      <AdminConfirmDialog
        open={pendingBulkDelete}
        title="Delete these tags?"
        description={`Delete ${String(selectedTags.length)} ${
          selectedTags.length === 1 ? "tag" : "tags"
        }? Each is removed from every course and lesson it is attached to.`}
        confirmLabel="Delete tags"
        busyLabel="Deleting…"
        cancelLabel="Keep tags"
        icon={Trash2}
        tone="danger"
        busy={bulkBusy}
        onConfirm={() => {
          void runBulk({
            action: "delete",
            tagIds: selectedTags.slice(0, TAG_BULK_LIMIT).map((tag) => tag.id),
          });
        }}
        onCancel={() => {
          setPendingBulkDelete(false);
        }}
      />

      <TagMergeDialog
        open={mergeOpen}
        candidates={mergeCandidates}
        busy={mergeBusy}
        error={mergeError}
        onSubmit={(input) => {
          void submitMerge(input);
        }}
        onCancel={() => {
          setMergeOpen(false);
          setMergeError(null);
        }}
      />

      <TagUsageDialog
        open={usageTag !== null}
        tag={usageTag}
        usage={usageData}
        loading={usageLoading}
        error={usageError}
        onClose={() => {
          setUsageTag(null);
        }}
      />
    </div>
  );
}
