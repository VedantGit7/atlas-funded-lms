"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  LayoutGrid,
  Minus,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  TrendingUp,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightWidgetHref,
} from "./admin-insights-catalog";
import type {
  InsightDashboardRange,
  InsightLibraryBoard,
  InsightLibraryItem,
  InsightLibraryMutation,
} from "./admin-insights-api";
import { vizLabel } from "./admin-insights-layout";
import { formatInsightMoney, formatInsightNumber } from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPrimaryButtonClassName,
  insightSelectContentClassName,
  insightSelectTriggerClassName,
  insightShimmerClassName,
} from "./admin-insights-shared";

type InsightLibraryViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightLibraryBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  range: InsightDashboardRange;
  target: string;
  onRangeChange: (range: InsightDashboardRange) => void;
  onTargetChange: (target: string) => void;
  onRetry: () => void;
  onMutate: (body: InsightLibraryMutation) => Promise<InsightLibraryBoard | null>;
};

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function spanLabel(span: InsightLibraryItem["span"]): string {
  if (span === "full") return "Full width";
  if (span === "third") return "Third width";
  return "Half width";
}

function formatPreviewValue(item: InsightLibraryItem, currency?: string): string {
  const value = item.preview.value ?? 0;
  if (item.preview.money) {
    return `${currency ? `${currency} ` : ""}${formatInsightMoney(value)}`;
  }
  return formatInsightNumber(value);
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="h-full w-full rounded bg-[var(--admin-surface-high)]" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="h-full w-full text-[var(--admin-primary)]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function PreviewThumb({
  item,
  currency,
}: {
  item: InsightLibraryItem;
  currency?: string | undefined;
}) {
  if (item.preview.kind === "kpi") {
    return (
      <div className="flex h-[120px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <div className="font-data text-[28px] font-medium leading-9 text-[var(--admin-on-surface)]">
          {formatPreviewValue(item, currency)}
        </div>
        {typeof item.preview.deltaPct === "number" ? (
          <div className="mt-1 flex items-center gap-1 text-[var(--admin-success)]">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-data text-[11px] font-semibold">
              {item.preview.deltaPct > 0 ? "+" : ""}
              {item.preview.deltaPct.toFixed(1)}%
            </span>
          </div>
        ) : null}
      </div>
    );
  }
  if (item.preview.kind === "series" || item.preview.kind === "funnel") {
    return (
      <div className="h-[120px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
        <Sparkline values={item.preview.sparkline ?? []} />
      </div>
    );
  }
  if (item.preview.kind === "table") {
    return (
      <div className="flex h-[120px] flex-col gap-1 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-6 rounded bg-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            style={{ width: `${88 - index * 10}%` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[12px] text-[var(--admin-on-surface-variant)]">
      {vizLabel(item.defaultViz)}
    </div>
  );
}

export function InsightLibraryView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  range,
  target,
  onRangeChange,
  onTargetChange,
  onRetry,
  onMutate,
}: InsightLibraryViewProps) {
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vizFilter, setVizFilter] = useState("");
  const [onlyOnDashboard, setOnlyOnDashboard] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKeys([]);
    setPreviewKey(null);
  }, [target]);

  const items = board?.items ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (needle) {
        const haystack = `${item.title} ${item.description} ${item.categoryLabel}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (sectionFilter && item.sourceSlug !== sectionFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (vizFilter && item.defaultViz !== vizFilter) return false;
      if (onlyOnDashboard && !item.onTarget) return false;
      return true;
    });
  }, [categoryFilter, items, onlyOnDashboard, query, sectionFilter, vizFilter]);

  const grouped = useMemo(() => {
    const groups: Array<{ id: string; label: string; items: InsightLibraryItem[] }> = [];
    for (const item of filtered) {
      const existing = groups.find((group) => group.id === item.category);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ id: item.category, label: item.categoryLabel, items: [item] });
      }
    }
    return groups;
  }, [filtered]);

  const previewItem =
    filtered.find((item) => item.key === previewKey) ??
    items.find((item) => item.key === previewKey) ??
    null;
  const selectedAddable = items.filter(
    (item) => selectedKeys.includes(item.key) && item.addable && !item.onTarget,
  );
  const selectedIds = Array.from(new Set(selectedAddable.map((item) => item.id)));
  const vizOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const item of items) {
      if (seen.has(item.defaultViz)) continue;
      seen.add(item.defaultViz);
      options.push({ value: item.defaultViz, label: vizLabel(item.defaultViz) });
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [items]);

  const hasFilters = Boolean(
    query || sectionFilter || categoryFilter || vizFilter || onlyOnDashboard,
  );

  const clearFilters = () => {
    setQuery("");
    setSectionFilter("");
    setCategoryFilter("");
    setVizFilter("");
    setOnlyOnDashboard(false);
  };

  const toggleSelected = (item: InsightLibraryItem) => {
    if (!item.addable || item.onTarget) return;
    setSelectedKeys((current) =>
      current.includes(item.key)
        ? current.filter((key) => key !== item.key)
        : [...current, item.key],
    );
  };

  const onAddSelected = async () => {
    if (selectedIds.length === 0) return;
    const saved = await onMutate({ action: "add", widgetIds: selectedIds });
    if (saved) setSelectedKeys([]);
  };

  return (
    <div className={insightPageClassName}>
      <div className="flex items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <span>/</span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-primary)]"
        >
          Insights
        </Link>
        <span>/</span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-primary)]"
        >
          {sectionTitle}
        </Link>
        <span>/</span>
        <span className="text-[var(--admin-on-surface)]">Library</span>
      </div>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className={insightPageTitleClassName}>Widget library</h1>
          <p className={insightPageDescClassName}>
            Everything that can be added to an insights dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Adding to</span>
            <Select
              ariaLabel="Dashboard to add widgets to"
              value={target}
              onValueChange={onTargetChange}
              options={(board?.sections ?? []).map((section) => ({
                value: section.slug,
                label: section.title,
              }))}
              className="h-8 min-w-[10rem] border-0 bg-transparent px-0 text-[var(--admin-on-surface)]"
              contentClassName={insightSelectContentClassName}
            />
          </div>
          <button
            type="button"
            className={insightPrimaryButtonClassName}
            disabled={selectedIds.length === 0 || mutating}
            onClick={() => {
              void onAddSelected();
            }}
          >
            Add selected ({selectedIds.length})
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-[var(--admin-danger)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
          <button type="button" className={insightGhostButtonClassName} onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search widget title..."
              className="h-10 w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] pl-10 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
          </div>
          <Select
            ariaLabel="Filter by section"
            value={sectionFilter}
            onValueChange={setSectionFilter}
            options={[
              { value: "", label: "All sections" },
              ...(board?.sections ?? []).map((section) => ({
                value: section.slug,
                label: section.title,
              })),
            ]}
            className="h-10 min-w-[10rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
            contentClassName={insightSelectContentClassName}
          />
          <Select
            ariaLabel="Filter by category"
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            options={[
              { value: "", label: "All categories" },
              ...(board?.categories ?? []).map((category) => ({
                value: category.id,
                label: category.label,
              })),
            ]}
            className="h-10 min-w-[10rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
            contentClassName={insightSelectContentClassName}
          />
          <Select
            ariaLabel="Filter by visualization"
            value={vizFilter}
            onValueChange={setVizFilter}
            options={[{ value: "", label: "All visualizations" }, ...vizOptions]}
            className="h-10 min-w-[10rem] border border-[var(--admin-outline)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]"
            contentClassName={insightSelectContentClassName}
          />
          <Select
            ariaLabel="Date range for previews"
            value={range}
            onValueChange={(value) => {
              onRangeChange(value as InsightDashboardRange);
            }}
            options={[...INSIGHT_RANGE_OPTIONS]}
            className={insightSelectTriggerClassName}
            contentClassName={insightSelectContentClassName}
          />
          <label className="flex cursor-pointer items-center gap-2 pl-1 text-[12px] text-[var(--admin-on-surface-variant)]">
            <button
              type="button"
              role="switch"
              aria-checked={onlyOnDashboard}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                onlyOnDashboard ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]"
              }`}
              onClick={() => {
                setOnlyOnDashboard((value) => !value);
              }}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform ${
                  onlyOnDashboard ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            Already on this dashboard
          </label>
        </div>
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">Filters:</span>
            {query ? (
              <FilterChip
                label={query}
                onRemove={() => {
                  setQuery("");
                }}
              />
            ) : null}
            {sectionFilter ? (
              <FilterChip
                label={
                  board?.sections.find((section) => section.slug === sectionFilter)?.title ??
                  sectionFilter
                }
                onRemove={() => {
                  setSectionFilter("");
                }}
              />
            ) : null}
            {categoryFilter ? (
              <FilterChip
                label={
                  board?.categories.find((category) => category.id === categoryFilter)?.label ??
                  categoryFilter
                }
                onRemove={() => {
                  setCategoryFilter("");
                }}
              />
            ) : null}
            {vizFilter ? (
              <FilterChip
                label={vizLabel(vizFilter as InsightLibraryItem["defaultViz"])}
                onRemove={() => {
                  setVizFilter("");
                }}
              />
            ) : null}
            {onlyOnDashboard ? (
              <FilterChip
                label="Already on dashboard"
                onRemove={() => {
                  setOnlyOnDashboard(false);
                }}
              />
            ) : null}
            <button
              type="button"
              className="ml-1 text-[12px] text-[var(--admin-primary)] hover:underline"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      {loading || !board ? (
        <InsightLibrarySkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <SearchX
              className="h-12 w-12 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
          </div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            No widgets match these filters
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Try adjusting your search terms or clearing current filters to find what you are looking
            for in the library.
          </p>
          <button
            type="button"
            className={`${insightGhostButtonClassName} mt-8`}
            onClick={clearFilters}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => (
            <section key={group.id} className="flex flex-col gap-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {group.items.map((item) => {
                  const selected = selectedKeys.includes(item.key);
                  return (
                    <LibraryCard
                      key={item.key}
                      item={item}
                      currency={board.currency}
                      selected={selected}
                      onPreview={() => {
                        setPreviewKey(item.key);
                      }}
                      onToggle={() => {
                        toggleSelected(item);
                      }}
                      onRemove={() => {
                        void onMutate({ action: "remove", widgetIds: [item.id] });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {previewItem ? (
        <LibraryPreviewDrawer
          item={previewItem}
          target={target}
          sections={board?.sections ?? []}
          currency={board?.currency}
          range={range}
          mutating={mutating}
          onClose={() => {
            setPreviewKey(null);
          }}
          onTargetChange={onTargetChange}
          onAdd={() => {
            void onMutate({ action: "add", widgetIds: [previewItem.id] });
          }}
          onRemove={() => {
            void onMutate({ action: "remove", widgetIds: [previewItem.id] });
          }}
        />
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[var(--admin-surface-high)] px-2 py-1 text-[12px] text-[var(--admin-on-surface)]">
      {label}
      <button
        type="button"
        className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function LibraryCard({
  item,
  currency,
  selected,
  onPreview,
  onToggle,
  onRemove,
}: {
  item: InsightLibraryItem;
  currency?: string | undefined;
  selected: boolean;
  onPreview: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const onDashboard = item.onTarget;
  return (
    <article
      className={`flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border bg-[var(--admin-surface)] ${
        selected
          ? "border-2 border-[var(--admin-primary)]"
          : onDashboard
            ? "border-[var(--admin-border)] bg-[var(--admin-surface-low)] opacity-90"
            : "border-[var(--admin-border)] hover:border-[var(--admin-outline)]"
      }`}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{item.title}</h3>
          {selected ? (
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
          ) : null}
          {onDashboard && !selected ? (
            <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--admin-success)]">
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              On this dashboard
            </span>
          ) : null}
        </div>
        <p className="mb-4 line-clamp-2 text-sm text-[var(--admin-on-surface-variant)]">
          {item.description}
        </p>
        <PreviewThumb item={item} currency={currency} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
            {vizLabel(item.defaultViz)}
          </span>
          <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
            {spanLabel(item.span)}
          </span>
          <span className="rounded bg-[var(--admin-surface-high)] px-2 py-1 font-data text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
            {item.sourceTitle}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3">
        <button
          type="button"
          className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
          onClick={onPreview}
        >
          Preview
        </button>
        {onDashboard ? (
          <button
            type="button"
            className={`${insightGhostButtonClassName} h-9 px-4`}
            onClick={onRemove}
          >
            Remove
          </button>
        ) : item.addable ? (
          <button
            type="button"
            className={`${selected ? insightGhostButtonClassName : insightPrimaryButtonClassName} h-9 px-4`}
            onClick={onToggle}
          >
            {selected ? (
              <Minus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            {selected ? "Selected" : "Add"}
          </button>
        ) : (
          <Link
            href={adminInsightHref(item.sourceSlug)}
            prefetch={false}
            className={`${insightGhostButtonClassName} h-9 px-4`}
          >
            Open {item.sourceTitle}
          </Link>
        )}
      </div>
    </article>
  );
}

function LibraryPreviewDrawer({
  item,
  target,
  sections,
  currency,
  range,
  mutating,
  onClose,
  onTargetChange,
  onAdd,
  onRemove,
}: {
  item: InsightLibraryItem;
  target: string;
  sections: Array<{ slug: string; title: string }>;
  currency?: string | undefined;
  range: InsightDashboardRange;
  mutating: boolean;
  onClose: () => void;
  onTargetChange: (target: string) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const targetTitle = sections.find((section) => section.slug === target)?.title ?? target;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-[2px]"
        aria-label="Close preview"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-preview-title"
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] motion-safe:animate-[admin-dropdown-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id="library-preview-title"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            {item.title}
          </h2>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
          <div className="rounded-lg border border-[var(--admin-border)] p-4">
            <div className="mb-3 flex items-center justify-end">
              <Link
                href={`${adminInsightWidgetHref(item.sourceSlug, item.id)}?range=${range}`}
                prefetch={false}
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                aria-label="Open full widget"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <PreviewThumb item={item} currency={currency} />
          </div>
          <p className="text-sm leading-6 text-[var(--admin-on-surface-variant)]">
            {item.description}
          </p>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Data source
              </span>
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {item.dataSource}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Refresh
              </span>
              <span className="font-data text-sm text-[var(--admin-on-surface)]">
                {item.refreshCadence}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Supported views
            </span>
            <div className="flex flex-wrap gap-2">
              {item.allowedViz.map((viz) => {
                const active = viz === item.defaultViz;
                return (
                  <span
                    key={viz}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      active
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]"
                        : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]"
                    }`}
                  >
                    {vizLabel(viz)}
                    {active ? (
                      <span className="ml-2 text-[10px] font-bold uppercase">Default</span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <footer className="flex h-20 shrink-0 items-center justify-between border-t border-[var(--admin-border)] px-6">
          <div className="flex min-w-0 flex-col">
            <span className="mb-1 text-[12px] text-[var(--admin-on-surface-variant)]">Add to</span>
            <Select
              ariaLabel="Dashboard destination"
              value={target}
              onValueChange={onTargetChange}
              options={sections.map((section) => ({ value: section.slug, label: section.title }))}
              className="h-8 min-w-[10rem] border-0 bg-transparent px-0 text-sm font-medium text-[var(--admin-on-surface)]"
              contentClassName={insightSelectContentClassName}
            />
          </div>
          {item.onTarget ? (
            <button
              type="button"
              className={insightGhostButtonClassName}
              disabled={mutating}
              onClick={onRemove}
            >
              Remove from {targetTitle}
            </button>
          ) : (
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={!item.addable || mutating}
              onClick={onAdd}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add to {targetTitle}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function InsightLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading widget library">
      {Array.from({ length: 2 }, (_, group) => (
        <section key={group}>
          <div className="mb-6 flex items-center gap-4">
            <Shimmer className="h-6 w-40" />
            <div className="h-px flex-1 bg-[var(--admin-border)]" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex gap-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
              >
                <Shimmer className="h-[120px] w-[120px] shrink-0 rounded-lg" />
                <div className="flex flex-1 flex-col py-1">
                  <Shimmer className="mb-3 h-5 w-3/4" />
                  <Shimmer className="mb-2 h-3 w-full" />
                  <Shimmer className="mb-auto h-3 w-5/6" />
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--admin-border)] pt-4">
                    <Shimmer className="h-4 w-20" />
                    <Shimmer className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
