"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
  inlineExpandClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
  adminInsightLibraryHref,
} from "./admin-insights-catalog";
import type {
  InsightLayout,
  InsightLayoutBoard,
  InsightLayoutCatalogItem,
  InsightLayoutMutation,
  InsightWidget,
} from "./admin-insights-api";
import {
  INSIGHT_SPAN_OPTIONS,
  catalogById,
  catalogKindCounts,
  clearLayoutDraft,
  countVizOverrides,
  isKpiCatalogItem,
  layoutsEqual,
  moveLayoutWidget,
  patchLayoutWidget,
  shiftLayoutWidget,
  summarizeDraft,
  vizLabel,
  widgetEditorSpanClass,
  writeLayoutDraft,
} from "./admin-insights-layout";
import {
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightShimmerClassName,
} from "./admin-insights-shared";
import type { VizType } from "../../analytics/viz";

type InsightCustomizeViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightLayoutBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  onRetry: () => void;
  onMutate: (body: InsightLayoutMutation) => Promise<InsightLayoutBoard | null>;
};

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function cloneLayout(layout: InsightLayout): InsightLayout {
  return {
    density: layout.density,
    sharing: layout.sharing,
    widgets: layout.widgets.map((entry) => ({ ...entry })),
  };
}

export function InsightCustomizeView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  onRetry,
  onMutate,
}: InsightCustomizeViewProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<InsightLayout | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (board) {
      setDraft(cloneLayout(board.layout));
      setCopyTarget(board.copyTargets[0]?.slug ?? "");
    }
  }, [board]);

  useEffect(() => {
    if (!addOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  const catalogMap = useMemo(() => catalogById(board?.catalog ?? []), [board?.catalog]);
  const dirty = Boolean(board && draft && !layoutsEqual(draft, board.layout));
  const summary = draft && board ? summarizeDraft(draft, board.catalog) : board?.summary;
  const kinds = board ? catalogKindCounts(board.catalog) : { kpis: 0, charts: 0 };
  const vizOverrides = draft && board ? countVizOverrides(draft, board.factory) : 0;
  const ordered = useMemo(
    () => (draft ? [...draft.widgets].sort((left, right) => left.order - right.order) : []),
    [draft],
  );
  const kpiEntries = ordered.filter(
    (entry) => isKpiCatalogItem(catalogMap.get(entry.id)) && !entry.hidden,
  );
  const chartEntries = ordered.filter(
    (entry) => !isKpiCatalogItem(catalogMap.get(entry.id)) && !entry.hidden,
  );
  const hiddenEntries = ordered.filter((entry) => entry.hidden);
  const totalCount = board?.catalog.length ?? 0;
  const shownCount = summary?.widgets ?? 0;

  const updateDraft = (next: InsightLayout) => {
    setDraft(next);
    setCopyMessage(null);
  };

  const onPreview = () => {
    if (!draft) return;
    writeLayoutDraft(slug, draft);
    router.push(`${adminInsightHref(slug)}?preview=1`);
  };

  const onSave = async () => {
    if (!draft) return;
    const saved = await onMutate({ action: "save", layout: draft });
    if (saved) {
      clearLayoutDraft(slug);
      setDraft(cloneLayout(saved.layout));
    }
  };

  const onReset = async () => {
    const saved = await onMutate({ action: "reset" });
    setResetOpen(false);
    if (saved) {
      clearLayoutDraft(slug);
      setDraft(cloneLayout(saved.layout));
    }
  };

  const onCopy = async () => {
    if (!draft || !copyTarget) return;
    const saved = await onMutate({ action: "copy", layout: draft, targetSlug: copyTarget });
    if (saved) {
      const target = saved.copyTargets.find((row) => row.slug === copyTarget);
      setCopyMessage(`Copied onto ${target?.title ?? "the other section"}.`);
    }
  };

  const copyLabel =
    board?.copyTargets.find((row) => row.slug === copyTarget)?.title ?? "Choose a section";

  return (
    <div className={insightPageClassName}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Customize</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-2xl">
          <h1 className={insightPageTitleClassName}>Customize {sectionTitle}</h1>
          <p className={insightPageDescClassName}>
            Choose which widgets appear in {sectionTitle}, their size, and how each is drawn.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!board || mutating}
            onClick={() => {
              setResetOpen(true);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to default layout
          </button>
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={!draft}
            onClick={onPreview}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview
          </button>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={!dirty || mutating}
              onClick={() => {
                void onSave();
              }}
            >
              Save layout
            </button>
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              {dirty ? "Unsaved changes" : "No unsaved changes"}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--admin-danger)]">
              Unable to load layout
            </h3>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            <button
              type="button"
              className={`${insightGhostButtonClassName} mt-4`}
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {loading || !board || !draft ? (
        <InsightCustomizeSkeleton />
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 pb-16 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
            <section className={`${insightPanelClassName} p-6`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Pinned KPIs
                </h2>
                <span className="text-xs italic text-[var(--admin-on-surface-variant)]">
                  KPIs always render first
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {kpiEntries.map((entry) => {
                  const item = catalogMap.get(entry.id);
                  if (!item) return null;
                  return (
                    <KpiCard
                      key={entry.id}
                      entryId={entry.id}
                      title={item.title}
                      draggingId={draggingId}
                      onDragStart={setDraggingId}
                      onMove={(targetId) => {
                        updateDraft(moveLayoutWidget(draft, entry.id, targetId));
                      }}
                      onShift={(direction) => {
                        updateDraft(
                          shiftLayoutWidget(
                            draft,
                            entry.id,
                            kpiEntries.map((row) => row.id),
                            direction,
                          ),
                        );
                      }}
                      onHide={() => {
                        updateDraft(patchLayoutWidget(draft, entry.id, { hidden: true }));
                      }}
                    />
                  );
                })}
              </div>
              {kpiEntries.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No KPI widgets are visible. Restore one from Hidden.
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Active widgets
              </h2>
              <div className="grid grid-cols-6 gap-6">
                {chartEntries.map((entry) => {
                  const item = catalogMap.get(entry.id);
                  if (!item) return null;
                  return (
                    <WidgetBlock
                      key={entry.id}
                      item={item}
                      span={entry.span}
                      viz={entry.viz}
                      draggingId={draggingId}
                      onDragStart={setDraggingId}
                      onMove={(targetId) => {
                        updateDraft(moveLayoutWidget(draft, entry.id, targetId));
                      }}
                      onShift={(direction) => {
                        updateDraft(
                          shiftLayoutWidget(
                            draft,
                            entry.id,
                            chartEntries.map((row) => row.id),
                            direction,
                          ),
                        );
                      }}
                      onSpan={(span) => {
                        updateDraft(patchLayoutWidget(draft, entry.id, { span }));
                      }}
                      onViz={(viz) => {
                        updateDraft(patchLayoutWidget(draft, entry.id, { viz }));
                      }}
                      onHide={() => {
                        updateDraft(patchLayoutWidget(draft, entry.id, { hidden: true }));
                      }}
                    />
                  );
                })}
                <div className="relative col-span-6">
                  <button
                    type="button"
                    className="flex h-24 w-full items-center justify-center gap-2 rounded border-2 border-dashed border-[var(--admin-outline)] text-sm font-medium text-[var(--admin-on-surface-variant)] outline-none transition-colors duration-200 hover:border-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                    onClick={() => {
                      setAddOpen((open) => !open);
                    }}
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                    Add widget
                  </button>
                  {addOpen ? (
                    <div
                      className={`absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-lg ${inlineExpandClassName}`}
                    >
                      {hiddenEntries.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                          Every widget for this dashboard is already visible.
                        </p>
                      ) : (
                        <ul className="max-h-64 overflow-y-auto">
                          {hiddenEntries.map((entry) => {
                            const item = catalogMap.get(entry.id);
                            if (!item) return null;
                            return (
                              <li key={entry.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    updateDraft(
                                      patchLayoutWidget(draft, entry.id, { hidden: false }),
                                    );
                                    setAddOpen(false);
                                  }}
                                >
                                  <span className="truncate">{item.title}</span>
                                  <span className="font-data text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                                    {item.defaultViz === "kpi" ? "KPI" : vizLabel(item.defaultViz)}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <Link
                        href={adminInsightLibraryHref(slug)}
                        prefetch={false}
                        className="mt-2 flex w-full items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
                      >
                        Browse widget library
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="border-t border-[var(--admin-border)] pt-8">
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface-variant)]">
                Hidden ({hiddenEntries.length})
              </h2>
              {hiddenEntries.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Nothing is hidden. Hide a KPI or widget to park it here.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {hiddenEntries.map((entry) => {
                    const item = catalogMap.get(entry.id);
                    if (!item) return null;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                            {item.title}
                          </div>
                          <div className="text-xs text-[var(--admin-on-surface-variant)]">
                            {item.defaultViz === "kpi" ? "KPI" : vizLabel(item.defaultViz)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-sm font-medium text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                          onClick={() => {
                            updateDraft(patchLayoutWidget(draft, entry.id, { hidden: false }));
                          }}
                        >
                          Show
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="flex w-full flex-col gap-6 xl:col-span-4">
            <section className={`${insightPanelClassName} p-5`}>
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                Layout settings
              </h2>
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] py-2">
                <span className="text-sm text-[var(--admin-on-surface-variant)]">
                  Widgets shown
                </span>
                <span className="font-data text-sm text-[var(--admin-on-surface)]">
                  {shownCount} of {totalCount}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] py-2">
                <span className="text-sm text-[var(--admin-on-surface-variant)]">KPIs pinned</span>
                <span className="font-data text-sm text-[var(--admin-on-surface)]">
                  {summary?.kpis ?? 0}
                </span>
              </div>
              <div className="py-3">
                <p className="mb-2 text-sm text-[var(--admin-on-surface-variant)]">Grid density</p>
                <div
                  className={insightSegmentTrackClassName}
                  role="radiogroup"
                  aria-label="Layout density"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.density === "comfortable"}
                    className={
                      draft.density === "comfortable"
                        ? `${insightSegmentButtonActiveClassName} flex-1 justify-center`
                        : `${insightSegmentButtonClassName} flex-1 justify-center`
                    }
                    onClick={() => {
                      updateDraft({ ...draft, density: "comfortable" });
                    }}
                  >
                    Comfortable
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.density === "compact"}
                    className={
                      draft.density === "compact"
                        ? `${insightSegmentButtonActiveClassName} flex-1 justify-center`
                        : `${insightSegmentButtonClassName} flex-1 justify-center`
                    }
                    onClick={() => {
                      updateDraft({ ...draft, density: "compact" });
                    }}
                  >
                    Compact
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Preview uses this draft on {sectionTitle}. Save layout to keep it.
              </p>
            </section>

            <section className={`${insightPanelClassName} p-5`}>
              <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                Visibility and sharing
              </h2>
              <div className="space-y-3" role="radiogroup" aria-label="Layout sharing">
                <SharingOption
                  checked={draft.sharing === "private"}
                  label="Only me"
                  hint="Layout is private to your account."
                  onSelect={() => {
                    updateDraft({ ...draft, sharing: "private" });
                  }}
                />
                <SharingOption
                  checked={draft.sharing === "tenant"}
                  label="Everyone with access"
                  hint="Sets this layout as the default for operators who can open this section."
                  onSelect={() => {
                    updateDraft({ ...draft, sharing: "tenant" });
                  }}
                />
              </div>
              {board.copyTargets.length > 0 ? (
                <div className="mt-6 border-t border-[var(--admin-border)] pt-4">
                  <DropdownField
                    label={
                      <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                        Copy onto another section
                      </span>
                    }
                    labelId="copy-layout-target"
                    open={copyOpen}
                    disabled={mutating}
                    onToggle={() => {
                      setCopyOpen((open) => !open);
                    }}
                    triggerContent={copyLabel}
                    panelAriaLabel="Copy layout destination"
                  >
                    <div className="max-h-64 overflow-y-auto p-1">
                      {board.copyTargets.map((target) => (
                        <button
                          key={target.slug}
                          type="button"
                          role="option"
                          aria-selected={copyTarget === target.slug}
                          className={dropdownItemClassName}
                          onClick={() => {
                            setCopyTarget(target.slug);
                            setCopyOpen(false);
                          }}
                        >
                          {target.title}
                        </button>
                      ))}
                    </div>
                  </DropdownField>
                  <button
                    type="button"
                    className={`${insightGhostButtonClassName} mt-2 w-full`}
                    disabled={!copyTarget || mutating}
                    onClick={() => {
                      void onCopy();
                    }}
                  >
                    Copy layout
                  </button>
                  {copyMessage ? (
                    <p className="mt-2 text-xs text-[var(--admin-success)]">{copyMessage}</p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className={`${insightPanelClassName} p-5`}>
              <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                Defaults
              </h2>
              <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
                Revert widget order, sizes, and visualizations to the shipped layout for this
                section.
              </p>
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded border border-[var(--admin-outline)] bg-transparent px-4 text-sm font-medium text-[var(--admin-danger)] outline-none transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={mutating}
                onClick={() => {
                  setResetOpen(true);
                }}
              >
                Reset every widget to server default
              </button>
            </section>
          </aside>
        </div>
      )}

      {resetOpen ? (
        <ResetLayoutModal
          kpiCount={kinds.kpis}
          chartCount={kinds.charts}
          vizOverrides={vizOverrides}
          onCancel={() => {
            setResetOpen(false);
          }}
          onConfirm={() => {
            void onReset();
          }}
        />
      ) : null}
    </div>
  );
}

function SharingOption({
  checked,
  label,
  hint,
  onSelect,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
        checked
          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
          : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]"
      }`}
      onClick={onSelect}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-[var(--admin-primary)]" : "border-[var(--admin-outline)]"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">{hint}</span>
      </span>
    </button>
  );
}

function KpiCard({
  entryId,
  title,
  draggingId,
  onDragStart,
  onMove,
  onShift,
  onHide,
}: {
  entryId: string;
  title: string;
  draggingId: string | null;
  onDragStart: (id: string | null) => void;
  onMove: (targetId: string) => void;
  onShift: (direction: -1 | 1) => void;
  onHide: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${
        draggingId === entryId ? "opacity-60" : ""
      }`}
      draggable
      onDragStart={() => {
        onDragStart(entryId);
      }}
      onDragEnd={() => {
        onDragStart(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggingId) onMove(entryId);
        onDragStart(null);
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <GripVertical
          className="h-5 w-5 shrink-0 cursor-grab text-[var(--admin-outline)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            {title}
          </div>
          <div className="mt-1 font-data text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            KPI
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Move ${title} earlier`}
          onClick={() => {
            onShift(-1);
          }}
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Move ${title} later`}
          onClick={() => {
            onShift(1);
          }}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
          aria-label={`Hide ${title}`}
          onClick={onHide}
        >
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function WidgetBlock({
  item,
  span,
  viz,
  draggingId,
  onDragStart,
  onMove,
  onShift,
  onSpan,
  onViz,
  onHide,
}: {
  item: InsightLayoutCatalogItem;
  span: InsightWidget["span"];
  viz: VizType;
  draggingId: string | null;
  onDragStart: (id: string | null) => void;
  onMove: (targetId: string) => void;
  onShift: (direction: -1 | 1) => void;
  onSpan: (span: InsightWidget["span"]) => void;
  onViz: (viz: VizType) => void;
  onHide: () => void;
}) {
  const allowed =
    item.allowedViz && item.allowedViz.length > 0 ? item.allowedViz : [item.defaultViz];
  return (
    <article
      className={`flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${widgetEditorSpanClass(span)} ${
        draggingId === item.id ? "opacity-60" : ""
      }`}
      draggable
      onDragStart={() => {
        onDragStart(item.id);
      }}
      onDragEnd={() => {
        onDragStart(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggingId) onMove(item.id);
        onDragStart(null);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <GripVertical
            className="mt-0.5 h-5 w-5 shrink-0 cursor-grab text-[var(--admin-outline)]"
            aria-hidden="true"
          />
          <h3 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
            {item.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            {vizLabel(viz)}
          </span>
          <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            {span}
          </span>
        </div>
      </div>
      <VizSketch viz={viz} />
      <div className="flex flex-col gap-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)]"
          role="group"
          aria-label={`${item.title} width`}
        >
          {INSIGHT_SPAN_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                span === option.value
                  ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] font-medium text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              }`}
              onClick={() => {
                onSpan(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {allowed.length > 1 ? (
            <div
              className="flex overflow-hidden rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)]"
              role="group"
              aria-label={`${item.title} visualization`}
            >
              {allowed.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                    viz === option
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] font-medium text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                  }`}
                  onClick={() => {
                    onViz(option);
                  }}
                >
                  {vizLabel(option)}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Move ${item.title} earlier`}
            onClick={() => {
              onShift(-1);
            }}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Move ${item.title} later`}
            onClick={() => {
              onShift(1);
            }}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label={`Hide ${item.title}`}
            onClick={onHide}
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function VizSketch({ viz }: { viz: VizType }) {
  return (
    <div className="flex h-32 items-center justify-center rounded border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
      <span className="text-xs text-[var(--admin-on-surface-variant)]">{vizLabel(viz)} canvas</span>
    </div>
  );
}

function ResetLayoutModal({
  kpiCount,
  chartCount,
  vizOverrides,
  onCancel,
  onConfirm,
}: {
  kpiCount: number;
  chartCount: number;
  vizOverrides: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-layout-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2
              id="reset-layout-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Reset layout to default?
            </h2>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            This will return{" "}
            <span className="font-data text-[var(--admin-on-surface)]">{kpiCount}</span> KPIs and{" "}
            <span className="font-data text-[var(--admin-on-surface)]">{chartCount}</span> widgets
            to their server-suggested order and size.
            {vizOverrides > 0 ? (
              <>
                {" "}
                Your{" "}
                <span className="font-data text-[var(--admin-on-surface)]">
                  {vizOverrides}
                </span>{" "}
                personal visualization {vizOverrides === 1 ? "choice" : "choices"} will be cleared.
              </>
            ) : (
              <> No personal visualization choices are set.</>
            )}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button type="button" className={insightGhostButtonClassName} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded bg-[var(--admin-danger)] px-4 text-sm font-medium text-[var(--admin-on-danger)] outline-none transition-[background-color,transform] duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 motion-safe:active:scale-[0.98]"
            onClick={onConfirm}
          >
            Confirm reset
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightCustomizeSkeleton() {
  return (
    <div
      className="grid grid-cols-1 items-start gap-8 xl:grid-cols-12"
      aria-busy="true"
      aria-label="Loading layout editor"
    >
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
        <div className={`${insightPanelClassName} p-6`}>
          <Shimmer className="mb-4 h-5 w-32" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex h-24 flex-col justify-between rounded-lg border border-[var(--admin-border)] p-4"
              >
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-8 w-16" />
              </div>
            ))}
          </div>
        </div>
        <Shimmer className="h-5 w-40" />
        <div className="grid grid-cols-6 gap-6">
          <div className={`col-span-6 ${insightPanelClassName} h-56 p-4`}>
            <Shimmer className="mb-4 h-5 w-48" />
            <Shimmer className="h-32 w-full" />
          </div>
          <div className={`col-span-6 md:col-span-3 ${insightPanelClassName} h-56 p-4`}>
            <Shimmer className="mb-4 h-5 w-32" />
            <Shimmer className="h-32 w-full" />
          </div>
          <div className={`col-span-6 md:col-span-3 ${insightPanelClassName} h-56 p-4`}>
            <Shimmer className="mb-4 h-5 w-28" />
            <Shimmer className="h-32 w-full" />
          </div>
        </div>
      </div>
      <aside className="flex w-full flex-col gap-6 xl:col-span-4">
        <div className={`${insightPanelClassName} p-5`}>
          <Shimmer className="mb-5 h-5 w-40" />
          <Shimmer className="mb-3 h-4 w-full" />
          <Shimmer className="mb-3 h-4 w-full" />
          <Shimmer className="h-10 w-full" />
        </div>
        <div className={`${insightPanelClassName} p-5`}>
          <Shimmer className="mb-5 h-5 w-48" />
          <Shimmer className="mb-3 h-16 w-full" />
          <Shimmer className="h-16 w-full" />
        </div>
        <div className={`${insightPanelClassName} p-5`}>
          <Shimmer className="mb-4 h-5 w-24" />
          <Shimmer className="mb-3 h-3 w-full" />
          <Shimmer className="h-11 w-full" />
        </div>
      </aside>
    </div>
  );
}
