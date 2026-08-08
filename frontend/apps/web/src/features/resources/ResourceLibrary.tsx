"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import type {
  ResourceItem,
  ResourceKind,
  ResourceListResponse,
  ResourceSort,
} from "@atlas/contracts/resources/schemas";
import { clientApi } from "../../lib/client-api";
import { ResourceCard } from "./ResourceCard";
import { KIND_META, SORT_OPTIONS } from "./resource-view";

type Facets = { categories: string[]; kinds: ResourceKind[] };

type ResourceLibraryProps = {
  initialItems: ResourceItem[];
  initialPageInfo: { nextCursor: string | null; hasNextPage: boolean };
  initialTotal: number;
  facets: Facets;
};

const PAGE_LIMIT = 24;

export function ResourceLibrary({
  initialItems,
  initialPageInfo,
  initialTotal,
  facets,
}: ResourceLibraryProps) {
  const [items, setItems] = useState<ResourceItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialPageInfo.nextCursor);
  const [hasNextPage, setHasNextPage] = useState<boolean>(initialPageInfo.hasNextPage);
  const [total, setTotal] = useState<number>(initialTotal);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedKinds, setSelectedKinds] = useState<Set<ResourceKind>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<ResourceSort>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const reduce = useReducedMotion();

  const buildQuery = useCallback(
    (nextCursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      params.set("sort", sort);
      if (committedQuery) params.set("q", committedQuery);
      if (selectedKinds.size > 0) params.set("kinds", [...selectedKinds].join(","));
      if (selectedCategories.size > 0) params.set("categories", [...selectedCategories].join(","));
      if (nextCursor) params.set("cursor", nextCursor);
      return params;
    },
    [sort, committedQuery, selectedKinds, selectedCategories],
  );

  // Debounce the free-text search into a committed value that drives fetching.
  useEffect(() => {
    const handle = setTimeout(() => {
      setCommittedQuery(query.trim());
    }, 350);
    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  // Refetch page 1 whenever the server-driven filters/sort/search change.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    clientApi
      .get<ResourceListResponse>(`/api/v1/me/resources?${buildQuery().toString()}`)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setCursor(res.data.pageInfo.nextCursor);
        setHasNextPage(res.data.pageInfo.hasNextPage);
        setTotal(res.data.total);
      })
      .catch(() => {
        // Keep the previous results visible; the toolbar stays available to retry.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildQuery]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await clientApi.get<ResourceListResponse>(
        `/api/v1/me/resources?${buildQuery(cursor).toString()}`,
      );
      setItems((prev) => [...prev, ...res.data.items]);
      setCursor(res.data.pageInfo.nextCursor);
      setHasNextPage(res.data.pageInfo.hasNextPage);
    } catch {
      // Leave the button available to retry.
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleKind(kind: ResourceKind) {
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function clearAll() {
    setSelectedKinds(new Set());
    setSelectedCategories(new Set());
    setQuery("");
    setCommittedQuery("");
  }

  const hasActiveFilters =
    selectedKinds.size > 0 || selectedCategories.size > 0 || committedQuery.length > 0;

  const rail = (
    <FilterRail
      facets={facets}
      selectedKinds={selectedKinds}
      selectedCategories={selectedCategories}
      onToggleKind={toggleKind}
      onToggleCategory={toggleCategory}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20">{rail}</div>
      </aside>

      <div className="min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search the library..."
                aria-label="Search resources"
                className="h-10 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setFiltersOpen((value) => !value);
              }}
              aria-expanded={filtersOpen}
              className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
            </button>
            <ViewToggle view={view} onChange={setView} />
            <SortDropdown value={sort} onChange={setSort} />
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                key="mobile-filters"
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden lg:hidden"
              >
                <div className="pt-1">{rail}</div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {(hasActiveFilters || total > 0) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {committedQuery ? (
                <Chip
                  label={`“${committedQuery}”`}
                  onRemove={() => {
                    setQuery("");
                    setCommittedQuery("");
                  }}
                />
              ) : null}
              {[...selectedCategories].map((category) => (
                <Chip
                  key={`cat-${category}`}
                  label={category}
                  onRemove={() => {
                    toggleCategory(category);
                  }}
                />
              ))}
              {[...selectedKinds].map((kind) => (
                <Chip
                  key={`kind-${kind}`}
                  label={KIND_META[kind].label}
                  onRemove={() => {
                    toggleKind(kind);
                  }}
                />
              ))}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
                >
                  Clear all
                </button>
              ) : null}
              <span className="ml-auto text-sm text-muted-foreground">
                {total.toLocaleString()} {total === 1 ? "resource" : "resources"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <ResourceSkeletonGrid view={view} />
        ) : items.length === 0 ? (
          <EmptyState hasActiveFilters={hasActiveFilters} onClear={clearAll} />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} view="grid" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} view="list" />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && hasNextPage ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted disabled:opacity-60 motion-safe:active:scale-95"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
              {loadingMore ? "Loading..." : "Load more resources"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterRail({
  facets,
  selectedKinds,
  selectedCategories,
  onToggleKind,
  onToggleCategory,
}: {
  facets: Facets;
  selectedKinds: Set<ResourceKind>;
  selectedCategories: Set<string>;
  onToggleKind: (kind: ResourceKind) => void;
  onToggleCategory: (category: string) => void;
}) {
  const hasCategories = facets.categories.length > 0;
  const hasKinds = facets.kinds.length > 0;

  if (!hasCategories && !hasKinds) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Filters appear here once your courses include downloadable materials.
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-4">
      {hasCategories ? (
        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </h3>
          <div className="space-y-0.5">
            {facets.categories.map((category) => (
              <CheckRow
                key={category}
                label={category}
                checked={selectedCategories.has(category)}
                onToggle={() => {
                  onToggleCategory(category);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasKinds ? (
        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            File types
          </h3>
          <div className="space-y-0.5">
            {facets.kinds.map((kind) => {
              const meta = KIND_META[kind];
              return (
                <CheckRow
                  key={kind}
                  label={meta.label}
                  checked={selectedKinds.has(kind)}
                  onToggle={() => {
                    onToggleKind(kind);
                  }}
                  icon={
                    <meta.Icon
                      className="h-4 w-4"
                      style={{ color: meta.tone }}
                      aria-hidden="true"
                    />
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
  icon,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-primary bg-primary text-[color:var(--primary-foreground)]"
            : "border-border",
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : null}
      </span>
      {icon}
      <span className="flex-1 truncate text-foreground">{label}</span>
    </button>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="text-muted-foreground transition-colors hover:text-[color:var(--destructive)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border p-0.5">
      {(
        [
          { value: "list" as const, Icon: List, label: "List view" },
          { value: "grid" as const, Icon: LayoutGrid, label: "Grid view" },
        ]
      ).map((option) => {
        const active = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
            }}
            aria-label={option.label}
            aria-pressed={active}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-primary text-[color:var(--primary-foreground)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: ResourceSort;
  onChange: (value: ResourceSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLabel = SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Sort";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
      >
        <span className="hidden text-muted-foreground sm:inline">Sort:</span>
        {activeLabel}
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className={cn(
            "absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg",
            dropdownPanelEnterEndClassName,
          )}
        >
          {SORT_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                  {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ResourceSkeletonGrid({ view }: { view: "grid" | "list" }) {
  const placeholders = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  if (view === "list") {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {placeholders.map((index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-3"
          >
            <div className="h-16 w-24 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="h-9 w-9 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {placeholders.map((index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-video w-full bg-muted motion-safe:animate-pulse" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FolderOpen className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {hasActiveFilters ? "No resources match these filters" : "No resources yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasActiveFilters
          ? "Try removing a filter or searching for something else."
          : "Downloadable files, links, and videos from the courses you are enrolled in will show up here."}
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}
