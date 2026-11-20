"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Eye,
  FileUp,
  Info,
  Loader2,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  catalogFilterButtonClassName,
  catalogSearchClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import { selectClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import { listItems, type ItemDto, type ItemListPage, type ItemTypeDto } from "../api";
import { runBulkDelete, runBulkStatus } from "../bulk-status";
import { BULK_ITEM_STATUS_MAX } from "../schemas";
import { DEFAULT_ITEM_TYPE_VISUAL, getItemTypeVisual } from "./item-type-config";

/** Questions fetched per page. */
const PAGE_SIZE = 50;
/** Wait after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;

export type ItemBankFilters = {
  q: string;
  itemTypeKey: string;
  status: string;
  /** Only the questions one import added. */
  importBatchId: string;
};

type ItemBankTableProps = {
  initialPage: ItemListPage;
  initialFilters: ItemBankFilters;
  itemTypes: ItemTypeDto[];
};

type StatusKey = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
type TargetStatus = "PUBLISHED" | "DRAFT" | "ARCHIVED";
type BulkAction = TargetStatus | "DELETE";

type StatusConfig = {
  label: string;
  className: string;
  dotClassName: string;
};

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    className: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    dotClassName: "bg-[var(--admin-outline)]",
  },
  REVIEW: {
    label: "In review",
    className:
      "bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
    dotClassName: "bg-[var(--admin-warning)]",
  },
  PUBLISHED: {
    label: "Published",
    className:
      "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
    dotClassName: "bg-[var(--admin-success)]",
  },
  ARCHIVED: {
    label: "Archived",
    className:
      "bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_12%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
    dotClassName: "bg-[var(--admin-on-surface-variant)]",
  },
};

/** What each bulk action is called, and what it tells the admin. */
const ACTIONS: Record<
  BulkAction,
  { verb: string; busy: string; done: string; explain: string; tone: "primary" | "danger" }
> = {
  PUBLISHED: {
    verb: "Publish",
    busy: "Publishing",
    done: "published",
    explain: "Learners will see them in decks, practice and assessments that use them.",
    tone: "primary",
  },
  DRAFT: {
    verb: "Move to draft",
    busy: "Moving to draft",
    done: "moved to draft",
    explain: "Learners will stop seeing them until you publish them again.",
    tone: "primary",
  },
  ARCHIVED: {
    verb: "Archive",
    busy: "Archiving",
    done: "archived",
    explain:
      "Learners will stop seeing them. They stay in the bank and you can publish them again later.",
    tone: "danger",
  },
  DELETE: {
    verb: "Delete",
    busy: "Deleting",
    done: "deleted",
    explain:
      "They are removed from the item bank and learners stop seeing them. A question that a deck, collection or assessment uses, or that learners have answered, is kept; archive those instead.",
    tone: "danger",
  },
};

const ACTION_ICONS: Record<BulkAction, typeof Eye> = {
  PUBLISHED: Eye,
  DRAFT: Undo2,
  ARCHIVED: Archive,
  DELETE: Trash2,
};

const badgeClassName =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold";

const filterSelectClassName = `${selectClassName} w-auto py-2 pl-3 pr-8 text-sm`;

const checkboxClassName =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--admin-border)] accent-[var(--admin-primary)]";

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}

function extractStem(item: ItemDto): string {
  const stemValue = (item.contentJson as { stem?: unknown } | null)?.stem;
  if (typeof stemValue === "string") return stemValue;
  if (typeof stemValue === "number") return String(stemValue);
  return "";
}

function formatItemRef(id: string): string {
  return `ITEM-${id.slice(0, 8).toUpperCase()}`;
}

function statusConfigFor(status: string): StatusConfig {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as StatusKey];
  }
  return {
    label: status,
    className: DEFAULT_ITEM_TYPE_VISUAL.badgeClassName,
    dotClassName: "bg-[var(--admin-outline)]",
  };
}

/** The filters as list-query fields, empty ones left out. */
function queryFor(filters: ItemBankFilters) {
  return {
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
    ...(filters.itemTypeKey ? { itemTypeKey: filters.itemTypeKey } : {}),
    ...(filters.status in STATUS_CONFIG ? { status: filters.status as StatusKey } : {}),
    ...(filters.importBatchId ? { importBatchId: filters.importBatchId } : {}),
  };
}

function sameFilters(a: ItemBankFilters, b: ItemBankFilters): boolean {
  return (
    a.q.trim() === b.q.trim() &&
    a.itemTypeKey === b.itemTypeKey &&
    a.status === b.status &&
    a.importBatchId === b.importBatchId
  );
}

/** Keeps the filters in the address, so a reload or a shared link shows the same list. */
function writeFiltersToUrl(filters: ItemBankFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.itemTypeKey) params.set("type", filters.itemTypeKey);
  if (filters.status) params.set("status", filters.status);
  if (filters.importBatchId) params.set("batch", filters.importBatchId);
  const suffix = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}`);
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfigFor(status);

  return (
    <span className={`${badgeClassName} ${cfg.className}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dotClassName}`}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

function ItemRow({
  item,
  typeNameByKey,
  selected,
  busy,
  onToggle,
  onSetStatus,
}: {
  item: ItemDto;
  typeNameByKey: Map<string, string>;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onSetStatus: (status: TargetStatus) => void;
}) {
  const stem = extractStem(item);
  const typeName = typeNameByKey.get(item.itemTypeKey) ?? item.itemTypeKey;
  const typeVisual = getItemTypeVisual(item.itemTypeKey);
  const label = stem || formatItemRef(item.id);
  const quick: { status: TargetStatus; label: string; Icon: typeof Eye } | null =
    item.status === "PUBLISHED"
      ? { status: "DRAFT", label: "Unpublish", Icon: Undo2 }
      : { status: "PUBLISHED", label: "Publish", Icon: Eye };

  return (
    <li
      className={`group flex items-start gap-3 px-4 py-4 transition-colors md:px-6 md:py-5 ${
        selected
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
          : "hover:bg-[var(--admin-surface-low)]"
      }`}
    >
      <input
        type="checkbox"
        className={`${checkboxClassName} mt-1`}
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${label}`}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`${badgeClassName} ${typeVisual.badgeClassName}`}>{typeName}</span>
          <StatusBadge status={item.status} />
          <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]/60">
            {formatItemRef(item.id)}
          </span>
          <span className="text-[11px] text-[var(--admin-on-surface-variant)]/60">
            {new Date(item.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        <p className="line-clamp-2 text-base font-semibold leading-snug text-[var(--admin-on-surface)]">
          {stem || (
            <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {item.id.slice(0, 8)}
            </span>
          )}
        </p>

        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]/70">No tags</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
        {item.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onSetStatus(quick.status);
            }}
            className={`${catalogFilterButtonClassName} justify-center px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-60 motion-safe:active:scale-[0.98]`}
            aria-label={`${quick.label} ${label}`}
          >
            <quick.Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {quick.label}
          </button>
        ) : null}
        <Link
          href={`/studio/items/${item.id}`}
          className={`${catalogFilterButtonClassName} justify-center px-3 py-2 text-sm motion-safe:active:scale-[0.98] group-hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] group-hover:text-[var(--admin-primary)]`}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Link>
      </div>
    </li>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Search className="h-10 w-10 text-[var(--admin-on-surface-variant)]/50" aria-hidden="true" />
      <p className="text-base font-semibold text-[var(--admin-on-surface)]">
        No questions match your filters
      </p>
      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
        Try another type or status, or clear the search.
      </p>
      <button
        type="button"
        onClick={onClear}
        className={`${catalogFilterButtonClassName} mt-1 px-4 py-2 font-semibold motion-safe:active:scale-[0.98]`}
      >
        Clear filters
      </button>
    </div>
  );
}

export function ItemBankEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-14 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_70%,var(--admin-surface))]">
        <BookOpen className="h-7 w-7 text-[var(--admin-primary)]" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">No questions yet</h2>
      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
        Create a question, or import many at once from an Excel template. Questions can be reused
        across assessments, decks and practice.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link
          href="/studio/items/import"
          className={`${outlineButtonClassName} inline-flex items-center gap-1.5 px-4 py-2`}
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Import questions
        </Link>
        <Link href="/studio/items/new" className={primaryButtonClassName}>
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Create item
        </Link>
      </div>
    </div>
  );
}

type Selection = { kind: "ids"; ids: Set<string> } | { kind: "matching" };

type PendingAction = { status: BulkAction; ids: string[] | null; count: number };

type Notice = { tone: "success" | "error"; text: string };

export function ItemBankTable({ initialPage, initialFilters, itemTypes }: ItemBankTableProps) {
  const [filters, setFilters] = useState<ItemBankFilters>(initialFilters);
  const [applied, setApplied] = useState<ItemBankFilters>(initialFilters);
  const [items, setItems] = useState<ItemDto[]>(initialPage.data);
  const [total, setTotal] = useState(initialPage.page.total);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "ids", ids: new Set() });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState<{ updated: number; remaining: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const request = useRef(0);

  const typeNameByKey = useMemo(() => new Map(itemTypes.map((t) => [t.key, t.name])), [itemTypes]);

  const load = useCallback(async (next: ItemBankFilters) => {
    const id = ++request.current;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await listItems({ ...queryFor(next), limit: PAGE_SIZE });
      if (id !== request.current) return;
      setItems(page.data);
      setTotal(page.page.total);
      setNextCursor(page.page.nextCursor);
      setApplied(next);
      setSelection({ kind: "ids", ids: new Set() });
    } catch {
      if (id === request.current) setLoadError("The questions could not be loaded. Try again.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  // Search after typing pauses; the selects apply at once.
  useEffect(() => {
    if (sameFilters(filters, applied)) return;
    writeFiltersToUrl(filters);
    const searchChanged = filters.q.trim() !== applied.q.trim();
    const timer = window.setTimeout(
      () => {
        void load(filters);
      },
      searchChanged ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters, applied, load]);

  async function loadMore() {
    if (!nextCursor) return;
    const id = request.current;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listItems({ ...queryFor(applied), limit: PAGE_SIZE, cursor: nextCursor });
      if (id !== request.current) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.data.filter((item) => !seen.has(item.id))];
      });
      setTotal(page.page.total);
      setNextCursor(page.page.nextCursor);
    } catch {
      setLoadError("More questions could not be loaded. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const hasActiveFilters = Boolean(
    filters.q.trim() || filters.itemTypeKey || filters.status || filters.importBatchId,
  );

  function clearFilters() {
    setFilters({ q: "", itemTypeKey: "", status: "", importBatchId: "" });
  }

  const selectedIds = selection.kind === "ids" ? selection.ids : null;
  const selectedCount = selection.kind === "matching" ? total : selection.ids.size;
  const allLoadedSelected =
    items.length > 0 &&
    (selection.kind === "matching" || items.every((item) => selection.ids.has(item.id)));
  const someLoadedSelected =
    selection.kind === "ids" && items.some((item) => selection.ids.has(item.id));
  const hasDrafts = items.some((item) => item.status === "DRAFT");

  function toggleOne(itemId: string) {
    setSelection((current) => {
      const ids = new Set(current.kind === "ids" ? current.ids : items.map((item) => item.id));
      if (ids.has(itemId)) ids.delete(itemId);
      else ids.add(itemId);
      return { kind: "ids", ids };
    });
  }

  function toggleAllLoaded() {
    setSelection(
      allLoadedSelected
        ? { kind: "ids", ids: new Set() }
        : { kind: "ids", ids: new Set(items.map((item) => item.id)) },
    );
  }

  function askToSetStatus(status: BulkAction, ids: string[] | null) {
    setActionError(null);
    setPending({ status, ids, count: ids ? ids.length : total });
  }

  async function confirmSetStatus() {
    if (!pending) return;
    const action = ACTIONS[pending.status];
    setActionError(null);
    setWorking({ updated: 0, remaining: pending.count });
    try {
      let updated = 0;
      let skipped = 0;
      let inUse = 0;
      const target = pending.status;
      const run = async (
        body: { itemIds: string[] } | { filter: ReturnType<typeof queryFor> },
        onProgress?: (done: number, remaining: number) => void,
      ) => {
        if (target === "DELETE") {
          const outcome = await runBulkDelete(body, onProgress);
          return { updated: outcome.deleted, skipped: outcome.skipped, inUse: outcome.inUse };
        }
        const outcome = await runBulkStatus({ status: target, ...body }, onProgress);
        return { updated: outcome.updated, skipped: outcome.skipped, inUse: 0 };
      };
      if (pending.ids) {
        for (let start = 0; start < pending.ids.length; start += BULK_ITEM_STATUS_MAX) {
          const chunk = pending.ids.slice(start, start + BULK_ITEM_STATUS_MAX);
          const outcome = await run({ itemIds: chunk });
          updated += outcome.updated;
          skipped += outcome.skipped;
          inUse += outcome.inUse;
          setWorking({ updated, remaining: Math.max(0, pending.count - start - chunk.length) });
        }
      } else {
        const outcome = await run({ filter: queryFor(applied) }, (done, remaining) => {
          setWorking({ updated: done, remaining });
        });
        updated = outcome.updated;
        skipped = outcome.skipped;
        inUse = outcome.inUse;
      }
      setPending(null);
      setNotice({
        tone: "success",
        text:
          `${plural(updated, "question", "questions")} ${action.done}.` +
          (inUse > 0
            ? ` ${plural(inUse, "question was", "questions were")} kept because a deck, collection or assessment uses ${inUse === 1 ? "it" : "them"} or learners have answered ${inUse === 1 ? "it" : "them"}; archive ${inUse === 1 ? "it" : "them"} to hide ${inUse === 1 ? "it" : "them"} from learners.`
            : "") +
          (skipped > 0
            ? ` ${plural(skipped, "question was", "questions were")} left as they were because another author created them.`
            : ""),
      });
      await load(applied);
    } catch {
      setActionError(
        "Not every question could be changed. Check your connection and try again; questions already changed stay changed.",
      );
    } finally {
      setWorking(null);
    }
  }

  const pendingAction = pending ? ACTIONS[pending.status] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm md:flex-row md:flex-wrap md:items-center">
        <div className="relative min-w-[200px] max-w-full flex-1 md:max-w-[320px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="item-bank-search">
            Search questions
          </label>
          <input
            id="item-bank-search"
            type="search"
            className={catalogSearchClassName}
            placeholder="Search question text, tags or reference"
            value={filters.q}
            maxLength={120}
            onChange={(e) => {
              setFilters((current) => ({ ...current, q: e.target.value }));
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="item-bank-type-filter">
            Filter by type
          </label>
          <select
            id="item-bank-type-filter"
            className={filterSelectClassName}
            value={filters.itemTypeKey}
            onChange={(e) => {
              setFilters((current) => ({ ...current, itemTypeKey: e.target.value }));
            }}
          >
            <option value="">All types</option>
            {itemTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="item-bank-status-filter">
            Filter by status
          </label>
          <select
            id="item-bank-status-filter"
            className={filterSelectClassName}
            value={filters.status}
            onChange={(e) => {
              setFilters((current) => ({ ...current, status: e.target.value }));
            }}
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_CONFIG[key].label}
              </option>
            ))}
          </select>

          {filters.importBatchId ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-primary-container)] py-1 pl-3 pr-1 text-xs font-semibold text-[var(--admin-on-primary-container)]">
              From one import
              <button
                type="button"
                onClick={() => {
                  setFilters((current) => ({ ...current, importBatchId: "" }));
                }}
                className="rounded-full p-1 transition-colors hover:bg-[var(--admin-surface)]/40"
                aria-label="Show questions from every import"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`${catalogFilterButtonClassName} px-4 py-2 text-sm font-medium motion-safe:active:scale-[0.98]`}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)] md:ml-auto"
          aria-live="polite"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {plural(total, "question", "questions")}
        </span>
      </div>

      {notice ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] text-[var(--admin-on-surface)]"
              : "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] text-[var(--admin-on-surface)]"
          }`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
              aria-hidden="true"
            />
          ) : (
            <XCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
          )}
          <p className="flex-1">{notice.text}</p>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
            }}
            className="rounded p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {hasDrafts && filters.status !== "PUBLISHED" ? (
        <p className="flex items-start gap-2 px-1 text-xs text-[var(--admin-on-surface-variant)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Learners never see Draft questions. Publish them to use them in decks, practice and
          assessments. Select several to publish them together.
        </p>
      ) : null}

      {loadError ? (
        <p
          role="alert"
          className="rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-on-surface)]"
        >
          {loadError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        {items.length === 0 ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-[var(--admin-on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading questions
            </div>
          ) : (
            <EmptyFiltered onClear={clearFilters} />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 md:px-6">
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={allLoadedSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allLoadedSelected && someLoadedSelected;
                }}
                onChange={toggleAllLoaded}
                aria-label="Select every question shown"
              />
              {selectedCount > 0 ? (
                <>
                  <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    {selection.kind === "matching"
                      ? `All ${plural(total, "matching question", "matching questions")} selected`
                      : `${selectedCount.toLocaleString("en")} selected`}
                  </span>
                  {selection.kind === "ids" && allLoadedSelected && total > items.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelection({ kind: "matching" });
                      }}
                      className="text-sm font-semibold text-[var(--admin-primary)] underline-offset-2 hover:underline"
                    >
                      Select all {total.toLocaleString("en")} matching
                    </button>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    {(["PUBLISHED", "DRAFT", "ARCHIVED", "DELETE"] as const).map((status) => {
                      const Icon = ACTION_ICONS[status];
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            askToSetStatus(status, selectedIds ? [...selectedIds] : null);
                          }}
                          className={
                            status === "PUBLISHED"
                              ? `${primaryButtonClassName} px-3 py-1.5 text-sm`
                              : status === "DELETE"
                                ? `${catalogFilterButtonClassName} px-3 py-1.5 text-sm text-[var(--admin-danger)] hover:border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-border))]`
                                : `${catalogFilterButtonClassName} px-3 py-1.5 text-sm`
                          }
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {ACTIONS[status].verb}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelection({ kind: "ids", ids: new Set() });
                      }}
                      className="px-2 py-1.5 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                    >
                      Clear selection
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Select questions to publish, unpublish or archive them together
                </span>
              )}
            </div>

            <ul
              className={`divide-y divide-[var(--admin-border)] transition-opacity ${loading ? "opacity-60" : ""}`}
            >
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  typeNameByKey={typeNameByKey}
                  selected={selection.kind === "matching" || Boolean(selectedIds?.has(item.id))}
                  busy={working !== null}
                  onToggle={() => {
                    toggleOne(item.id);
                  }}
                  onSetStatus={(status) => {
                    askToSetStatus(status, [item.id]);
                  }}
                />
              ))}
            </ul>
            <div className="flex flex-col items-center gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:justify-between md:px-6">
              <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                Showing {items.length.toLocaleString("en")} of{" "}
                {plural(total, "question", "questions")}
              </span>
              {nextCursor ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    void loadMore();
                  }}
                  className={`${catalogFilterButtonClassName} px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60`}
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                  Show {Math.min(PAGE_SIZE, total - items.length).toLocaleString("en")} more
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <AdminConfirmDialog
        open={pending !== null}
        title={
          pending && pendingAction
            ? `${pendingAction.verb} ${plural(pending.count, "question", "questions")}?`
            : ""
        }
        description={
          <span className="space-y-2">
            <span className="block">{pendingAction?.explain}</span>
            {working ? (
              <span className="block font-medium text-[var(--admin-on-surface)]" aria-live="polite">
                {plural(working.updated, "question", "questions")} done
                {working.remaining > 0 ? `, ${working.remaining.toLocaleString("en")} to go` : ""}
              </span>
            ) : null}
          </span>
        }
        confirmLabel={pendingAction?.verb ?? "Confirm"}
        {...(pendingAction ? { busyLabel: pendingAction.busy } : {})}
        tone={pendingAction?.tone ?? "primary"}
        icon={pending ? ACTION_ICONS[pending.status] : Eye}
        busy={working !== null}
        error={actionError}
        onConfirm={() => {
          void confirmSetStatus();
        }}
        onCancel={() => {
          if (working) return;
          setPending(null);
          setActionError(null);
        }}
      />
    </div>
  );
}
