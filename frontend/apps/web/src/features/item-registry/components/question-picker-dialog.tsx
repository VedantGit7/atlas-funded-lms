"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { ITEM_IMPORT_TYPE_NAMES } from "@atlas/contracts/item-registry/item-import.contract";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  inputClass,
  itemDisplayTitle,
  secondaryButtonClassName,
} from "../../assessments/assessment-studio-shared";
import { formatItemRegistryApiError, itemRegistryApi, type ItemDto } from "../api";

/** Questions fetched per page; the list API allows up to 100. */
const PAGE_SIZE = 50;
/** The most questions added in one go (the collection bulk add allows 100). */
export const QUESTION_PICKER_MAX = 100;

const TYPE_NAMES: Record<string, string> = ITEM_IMPORT_TYPE_NAMES;

export function questionTypeName(itemTypeKey: string): string {
  return TYPE_NAMES[itemTypeKey] ?? itemTypeKey.replaceAll("_", " ");
}

type QuestionPickerDialogProps = {
  open: boolean;
  title: string;
  /** Questions already added: shown ticked and locked. */
  addedIds: ReadonlySet<string>;
  /** Start with this status filter ("" for any). */
  initialStatus?: "" | "PUBLISHED" | "DRAFT";
  /** Shown above the list, e.g. which questions a deck can use. */
  note?: ReactNode;
  /**
   * Offer a collection filter and "Select all matching", for adding a whole
   * tag or collection as a quiz's random pool (S3.4).
   */
  poolTools?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (items: ItemDto[]) => void;
};

/**
 * Pick questions from the whole Item Bank (QA review 1 C8, review 2 C6): search
 * the text or tags, filter by type and status, page through every question,
 * and tick as many as needed. Replaces dropdowns that listed only the first 25
 * questions as "mcq_single — …". Used by the quiz builder and Collections.
 */
export function QuestionPickerDialog({
  open,
  title,
  addedIds,
  initialStatus = "",
  note,
  poolTools = false,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: QuestionPickerDialogProps) {
  const titleId = useId();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [itemTypeKey, setItemTypeKey] = useState("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [rows, setRows] = useState<ItemDto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, ItemDto>>(new Map());
  const [collectionId, setCollectionId] = useState("");
  const [collections, setCollections] = useState<Array<{ id: string; title: string }>>([]);
  const [selectingAll, setSelectingAll] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open || !poolTools) return;
    let cancelled = false;
    void itemRegistryApi
      .listItemCollections({ limit: 100 })
      .then((response) => {
        if (!cancelled) {
          setCollections(response.data.map((entry) => ({ id: entry.id, title: entry.title })));
        }
      })
      .catch(() => {
        if (!cancelled) setCollections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, poolTools]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuery("");
    setDebounced("");
    setItemTypeKey("");
    setStatus(initialStatus);
    setCollectionId("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open, initialStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const load = useCallback(
    async (after: string | null) => {
      const request = ++requestRef.current;
      setLoading(true);
      setLoadError(null);
      try {
        const page = await itemRegistryApi.listItems({
          limit: PAGE_SIZE,
          ...(debounced ? { q: debounced } : {}),
          ...(itemTypeKey ? { itemTypeKey } : {}),
          ...(status ? { status } : {}),
          ...(collectionId ? { collectionId } : {}),
          ...(after ? { cursor: after } : {}),
        });
        if (request !== requestRef.current) return;
        setRows((current) => (after ? [...current, ...page.data] : page.data));
        setTotal(page.page.total);
        setCursor(page.page.hasMore ? page.page.nextCursor : null);
      } catch (err) {
        if (request === requestRef.current) setLoadError(formatItemRegistryApiError(err));
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [debounced, itemTypeKey, status, collectionId],
  );

  /**
   * Ticks every question the search and filters match (up to the most added
   * at once), loading the pages not shown yet.
   */
  async function selectAllMatching() {
    setSelectingAll(true);
    setLoadError(null);
    try {
      const next = new Map(selected);
      let after: string | null = null;
      do {
        const page = await itemRegistryApi.listItems({
          limit: 100,
          ...(debounced ? { q: debounced } : {}),
          ...(itemTypeKey ? { itemTypeKey } : {}),
          ...(status ? { status } : {}),
          ...(collectionId ? { collectionId } : {}),
          ...(after ? { cursor: after } : {}),
        });
        for (const row of page.data) {
          if (next.size >= QUESTION_PICKER_MAX) break;
          if (!addedIds.has(row.id)) next.set(row.id, row);
        }
        after = page.page.hasMore ? page.page.nextCursor : null;
      } while (after && next.size < QUESTION_PICKER_MAX);
      setSelected(next);
    } catch (err) {
      setLoadError(formatItemRegistryApiError(err));
    } finally {
      setSelectingAll(false);
    }
  }

  useEffect(() => {
    if (open) void load(null);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, onCancel]);

  const selectable = useMemo(() => rows.filter((row) => !addedIds.has(row.id)), [rows, addedIds]);
  const allShownSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.id));
  const atLimit = selected.size >= QUESTION_PICKER_MAX;

  function toggle(row: ItemDto) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.id)) next.delete(row.id);
      else if (next.size < QUESTION_PICKER_MAX) next.set(row.id, row);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((current) => {
      const next = new Map(current);
      if (allShownSelected) {
        for (const row of selectable) next.delete(row.id);
      } else {
        for (const row of selectable) {
          if (next.size >= QUESTION_PICKER_MAX) break;
          next.set(row.id, row);
        }
      }
      return next;
    });
  }

  if (!open) return null;

  const count = selected.size;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              Search questions
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={query}
              placeholder="Search question text or tags"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className={`${inputClass} pl-9`}
            />
          </div>
          <div
            className={`grid gap-2 sm:items-center ${
              poolTools
                ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            }`}
          >
            <select
              aria-label="Question type"
              value={itemTypeKey}
              onChange={(event) => {
                setItemTypeKey(event.target.value);
              }}
              className={inputClass}
            >
              <option value="">All types</option>
              {Object.entries(TYPE_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
              }}
              className={inputClass}
            >
              <option value="">Any status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
            {poolTools ? (
              <select
                aria-label="Collection"
                value={collectionId}
                onChange={(event) => {
                  setCollectionId(event.target.value);
                }}
                className={inputClass}
              >
                <option value="">Any collection</option>
                {collections.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            ) : null}
            <p
              role="status"
              className={`text-xs text-[var(--admin-on-surface-variant)] ${
                poolTools ? "sm:col-span-3" : "sm:text-right"
              }`}
            >
              {total == null
                ? "Loading…"
                : `Showing ${String(rows.length)} of ${String(total)} question${total === 1 ? "" : "s"}`}
              {poolTools && total != null && total > rows.length ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    disabled={selectingAll || atLimit}
                    onClick={() => {
                      void selectAllMatching();
                    }}
                    className="rounded font-semibold text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50"
                  >
                    {selectingAll
                      ? "Selecting…"
                      : `Select all ${String(Math.min(total, QUESTION_PICKER_MAX))} matching`}
                  </button>
                </>
              ) : null}
            </p>
          </div>
          {note ? (
            <div className="text-xs text-[var(--admin-on-surface-variant)]">{note}</div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectable.length > 0 ? (
            <label className="flex items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              <input
                type="checkbox"
                checked={allShownSelected}
                onChange={toggleAllShown}
                className="h-4 w-4 accent-[var(--admin-primary)]"
              />
              Select all shown
            </label>
          ) : null}
          {loadError ? (
            <p role="alert" className="px-5 py-6 text-sm text-[var(--admin-danger)]">
              {loadError}
            </p>
          ) : rows.length === 0 && !loading ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
              {debounced || itemTypeKey || status || collectionId
                ? "No questions match. Try other words or filters."
                : "The Question bank has no questions yet."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {rows.map((row) => {
                const added = addedIds.has(row.id);
                const checked = added || selected.has(row.id);
                const stem = itemDisplayTitle(row.contentJson as Record<string, unknown>);
                return (
                  <li key={row.id}>
                    <label
                      className={`flex items-start gap-3 px-5 py-3 ${
                        added
                          ? "cursor-default opacity-60"
                          : "cursor-pointer hover:bg-[var(--admin-surface-low)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={added || (!checked && atLimit)}
                        onChange={() => {
                          toggle(row);
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--admin-primary)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm text-[var(--admin-on-surface)]">
                          {stem}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                          <span>{questionTypeName(row.itemTypeKey)}</span>
                          <span className={`${badgeClassName} ${STATUS_CONFIG[row.status] ?? ""}`}>
                            {STATUS_LABELS[row.status] ?? row.status}
                          </span>
                          {row.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                          {added ? <span className="font-semibold">Already added</span> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {cursor ? (
            <div className="px-5 py-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void load(cursor);
                }}
                className={`${secondaryButtonClassName} w-full justify-center`}
              >
                {loading ? "Loading…" : `Show ${String(PAGE_SIZE)} more`}
              </button>
            </div>
          ) : loading && rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-4">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {count === 0
              ? "Tick the questions to add."
              : `${String(count)} selected${atLimit ? ` (the most at once is ${String(QUESTION_PICKER_MAX)})` : ""}`}
          </p>
          {error ? (
            <p role="alert" className="w-full text-sm text-[var(--admin-danger)] sm:order-first">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className={secondaryButtonClassName}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || count === 0}
              onClick={() => {
                onConfirm([...selected.values()]);
              }}
              className={primaryButtonClassName}
            >
              {busy
                ? "Adding…"
                : count === 0
                  ? "Add questions"
                  : `Add ${String(count)} question${count === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
