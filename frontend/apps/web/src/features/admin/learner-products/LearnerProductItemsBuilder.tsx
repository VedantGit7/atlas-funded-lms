"use client";

import { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  FileStack,
  Layers,
  ListChecks,
  Loader2,
  Package,
  Plus,
  Search,
  GripVertical,
  Trash2,
} from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { itemKindLabel } from "./learner-products-shared";
import {
  searchPickerCandidates,
  type PickerCandidate,
  type ProductTypeSlug,
} from "./learner-products-api";

/** What each product kind is allowed to contain. */
export const ALLOWED_ITEM_KINDS: Record<ProductTypeSlug, readonly string[]> = {
  "mock-tests": ["assessment"],
  "test-series": ["mock_test"],
  bundles: ["course", "mock_test", "test_series"],
  "subscription-plans": ["course", "mock_test", "test_series", "bundle"],
};

const KIND_ICON: Record<string, typeof Layers> = {
  course: FileStack,
  mock_test: ListChecks,
  test_series: Layers,
  bundle: Package,
  assessment: ListChecks,
};

export type DraftItem = {
  /** Stable across reorders so React keys survive a move. */
  key: string;
  kind: string;
  refId: string;
  title: string | null;
};

let draftCounter = 0;
export function nextDraftKey(): string {
  draftCounter += 1;
  return `draft-${String(draftCounter)}`;
}

type ItemsBuilderProps = {
  type: ProductTypeSlug;
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  /** Mock tests wrap one assessment; the builder becomes a single picker. */
  singleSelection: PickerCandidate | null;
  onSingleSelectionChange: (candidate: PickerCandidate | null) => void;
  disabled?: boolean;
  /** Rendered above the picker; the create form and the editor word it differently. */
  emptyHint: string;
};

/**
 * The ordered contents of a product, plus the picker that fills it.
 *
 * Shared by the create form and the edit drawer, which is the point: the rules
 * about what a bundle may contain and how order is expressed belong in one
 * place, or the two screens drift into disagreeing about the same product.
 *
 * Reordering is buttons rather than drag-and-drop — the order decides what a
 * learner sees first, and a keyboard user should not need a pointer to set it.
 */
export function LearnerProductItemsBuilder({
  type,
  items,
  onChange,
  singleSelection,
  onSingleSelectionChange,
  disabled = false,
  emptyHint,
}: ItemsBuilderProps) {
  const kindFieldId = useId();
  const searchFieldId = useId();

  const allowedKinds = ALLOWED_ITEM_KINDS[type];
  const singleMode = type === "mock-tests";

  const [kind, setKind] = useState<string>(allowedKinds[0] ?? "course");
  const [kindOpen, setKindOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PickerCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setKind(allowedKinds[0] ?? "course");
    setTerm("");
    setResults([]);
  }, [type, allowedKinds]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchPickerCandidates(kind as never, term)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setSearchError("Could not search the catalogue.");
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, term]);

  function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    const moved = next[index];
    const displaced = next[target];
    if (!moved || !displaced) return;
    next[index] = displaced;
    next[target] = moved;
    onChange(next);
  }

  /**
   * Pointer reordering, alongside the buttons rather than instead of them.
   *
   * Native HTML5 drag is enough here — the list is short and vertical — and it
   * costs no dependency. The up/down buttons stay because drag-and-drop is
   * unusable by keyboard and awkward on touch, and reordering decides what a
   * learner sees first.
   */
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(next);
  }

  function addCandidate(candidate: PickerCandidate) {
    if (singleMode) {
      onSingleSelectionChange(candidate);
      return;
    }
    if (items.some((item) => item.kind === kind && item.refId === candidate.id)) return;
    onChange([
      ...items,
      { key: nextDraftKey(), kind, refId: candidate.id, title: candidate.title },
    ]);
  }

  return (
    <div className="space-y-5">
      {singleMode ? (
        <div>
          {singleSelection ? (
            <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-3">
              <ListChecks
                className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                  {singleSelection.title}
                </span>
                <span className="font-data block truncate text-xs text-[var(--admin-on-surface-variant)]">
                  {singleSelection.subtitle ?? singleSelection.id}
                </span>
              </span>
              <button
                type="button"
                aria-label="Choose a different assessment"
                disabled={disabled}
                onClick={() => {
                  onSingleSelectionChange(null);
                }}
                className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--admin-outline)] px-4 py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
              {emptyHint}
            </p>
          )}
        </div>
      ) : (
        <div>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--admin-outline)] px-4 py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
              {emptyHint}
            </p>
          ) : (
            <ol className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl border border-[var(--admin-border)]">
              {items.map((item, index) => {
                const Icon = KIND_ICON[item.kind] ?? Layers;
                return (
                  <li
                    key={item.key}
                    onDragOver={(event) => {
                      if (dragIndex === null) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (dragIndex === null) return;
                      event.preventDefault();
                      reorder(dragIndex, index);
                      setDragIndex(null);
                    }}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 motion-safe:transition-colors",
                      dragIndex === index
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                        : "",
                    ].join(" ")}
                  >
                    <span
                      draggable={!disabled}
                      aria-hidden="true"
                      onDragStart={() => {
                        setDragIndex(index);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                      }}
                      className="shrink-0 cursor-grab text-[var(--admin-on-surface-variant)] active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="font-data w-6 shrink-0 text-right text-xs text-[var(--admin-on-surface-variant)]">
                      {index + 1}
                    </span>
                    <Icon
                      className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        {itemKindLabel(item.kind)}
                      </span>
                      {item.title === null ? (
                        <span className="flex items-center gap-1 text-sm font-medium text-[var(--admin-danger)]">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          Deleted product — remove this row
                        </span>
                      ) : (
                        <span className="block truncate text-sm text-[var(--admin-on-surface)]">
                          {item.title}
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`Move ${item.title ?? "item"} up`}
                        disabled={disabled || index === 0}
                        onClick={() => {
                          move(index, -1);
                        }}
                        className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${item.title ?? "item"} down`}
                        disabled={disabled || index === items.length - 1}
                        onClick={() => {
                          move(index, 1);
                        }}
                        className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title ?? "item"}`}
                        disabled={disabled}
                        onClick={() => {
                          onChange(items.filter((entry) => entry.key !== item.key));
                        }}
                        className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] hover:text-[var(--admin-danger)] disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          {singleMode ? "Choose an assessment" : "Add an item"}
        </h4>

        {allowedKinds.length > 1 ? (
          <DropdownField
            label={<span className="sr-only">Item type</span>}
            labelId={kindFieldId}
            open={kindOpen}
            disabled={disabled}
            portalZIndex={85}
            panelAriaLabel="Item type"
            onToggle={() => {
              setKindOpen((previous) => !previous);
            }}
            triggerContent={itemKindLabel(kind)}
          >
            <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
              {allowedKinds.map((candidateKind) => (
                <button
                  key={candidateKind}
                  type="button"
                  role="option"
                  aria-selected={candidateKind === kind}
                  className={dropdownItemClassName}
                  onClick={() => {
                    setKind(candidateKind);
                    setKindOpen(false);
                    setResults([]);
                  }}
                >
                  <span className="flex-1">{itemKindLabel(candidateKind)}</span>
                  {candidateKind === kind ? (
                    <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </DropdownField>
        ) : null}

        <div className="relative">
          <label className="sr-only" htmlFor={searchFieldId}>
            Search {itemKindLabel(kind)}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id={searchFieldId}
            type="search"
            autoComplete="off"
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25 disabled:opacity-50"
            placeholder={`Search ${itemKindLabel(kind).toLowerCase()}`}
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
          {searching ? (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)] motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <p aria-live="polite" className="sr-only">
          {searching ? "Searching" : `${String(results.length)} results`}
        </p>

        {searchError ? (
          <p role="alert" className="text-xs text-[var(--admin-danger)]">
            {searchError}
          </p>
        ) : null}

        {results.length > 0 ? (
          <ul className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {results.map((candidate) => {
              const already =
                !singleMode &&
                items.some((item) => item.kind === kind && item.refId === candidate.id);
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={disabled || already}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:bg-[var(--admin-surface-high)] focus-visible:outline-none disabled:opacity-50"
                    onClick={() => {
                      addCandidate(candidate);
                    }}
                  >
                    <Plus
                      className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--admin-on-surface)]">
                        {candidate.title}
                      </span>
                      <span className="font-data block truncate text-xs text-[var(--admin-on-surface-variant)]">
                        {candidate.subtitle ?? candidate.id}
                      </span>
                    </span>
                    {already ? (
                      <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">
                        Added
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : !searching ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Nothing matches that search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
