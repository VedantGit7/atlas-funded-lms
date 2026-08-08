"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Pencil, PlusCircle, Search } from "lucide-react";
import {
  catalogFilterButtonClassName,
  catalogSearchClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import { selectClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import type { ItemDto, ItemTypeDto } from "../api";
import { DEFAULT_ITEM_TYPE_VISUAL, getItemTypeVisual } from "./item-type-config";

type ItemBankTableProps = {
  items: ItemDto[];
  itemTypes: ItemTypeDto[];
};

type StatusKey = "DRAFT" | "ACTIVE" | "ARCHIVED";

type StatusConfig = {
  label: string;
  className: string;
  dotClassName: string;
};

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
    dotClassName: "bg-[var(--admin-outline)]",
  },
  ACTIVE: {
    label: "Active",
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

const badgeClassName =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold";

const filterSelectClassName = `${selectClassName} w-auto py-2 pl-3 pr-8 text-sm`;

function extractStem(item: ItemDto): string {
  const stemValue = (item.contentJson as { stem?: unknown }).stem;
  if (typeof stemValue === "string") return stemValue;
  if (typeof stemValue === "number") return String(stemValue);
  return "";
}

function formatItemRef(id: string): string {
  return `ITEM-${id.slice(0, 8).toUpperCase()}`;
}

function itemMatchesSearch(item: ItemDto, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const stem = extractStem(item).toLowerCase();
  if (stem.includes(normalized)) return true;
  return item.tags.some((tag) => tag.toLowerCase().includes(normalized));
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

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfigFor(status);

  return (
    <span className={`${badgeClassName} ${cfg.className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dotClassName}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function ItemRow({
  item,
  typeNameByKey,
}: {
  item: ItemDto;
  typeNameByKey: Map<string, string>;
}) {
  const stem = extractStem(item);
  const typeName = typeNameByKey.get(item.itemTypeKey) ?? item.itemTypeKey;
  const typeVisual = getItemTypeVisual(item.itemTypeKey);

  return (
    <li className="group flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-[var(--admin-surface-low)] md:px-6 md:py-5">
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

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/studio/items/${item.id}`}
          className={`${catalogFilterButtonClassName} inline-flex items-center gap-1.5 px-3 py-2 text-sm motion-safe:active:scale-[0.98] group-hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] group-hover:text-[var(--admin-primary)]`}
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
        No items match your filters
      </p>
      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
        Try adjusting the type or status filter, or clear the search.
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
      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">No items yet</h2>
      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
        Create your first item using a registered item type. Items can be reused across
        assessments and practice sets.
      </p>
      <Link href="/studio/items/new" className={`${primaryButtonClassName} mt-2`}>
        <PlusCircle className="h-4 w-4" aria-hidden="true" />
        Create item
      </Link>
    </div>
  );
}

export function ItemBankTable({ items, itemTypes }: ItemBankTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const typeNameByKey = useMemo(
    () => new Map(itemTypes.map((t) => [t.key, t.name])),
    [itemTypes],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = itemMatchesSearch(item, search.trim());
      const matchesType = !typeFilter || item.itemTypeKey === typeFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, search, typeFilter, statusFilter]);

  const hasActiveFilters = Boolean(search.trim() || typeFilter || statusFilter);

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm md:flex-row md:flex-wrap md:items-center">
        <div className="relative min-w-[200px] max-w-full flex-1 md:max-w-[320px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="item-bank-search">
            Search items
          </label>
          <input
            id="item-bank-search"
            type="search"
            className={catalogSearchClassName}
            placeholder="Search by stem, tags, or content..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>

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

        <span className="text-sm text-[var(--admin-on-surface-variant)] md:ml-auto">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        {filtered.length === 0 ? (
          <EmptyFiltered onClear={clearFilters} />
        ) : (
          <>
            <ul className="divide-y divide-[var(--admin-border)]">
              {filtered.map((item) => (
                <ItemRow key={item.id} item={item} typeNameByKey={typeNameByKey} />
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 md:px-6">
              <span className="text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                Showing {filtered.length} of {items.length}{" "}
                {items.length === 1 ? "item" : "items"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
