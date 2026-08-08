"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  GitBranch,
  Mail,
  MoreVertical,
  PauseCircle,
  Plus,
  Search,
  Split,
  Users,
  Zap,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
} from "../manage/manage-ui-shared";
import {
  formatWorkflowCount,
  formatWorkflowDate,
  formatWorkflowDateTime,
  MARKETING_HREF,
  WORKFLOWS_CREATE_HREF,
  workflowHref,
  workflowStatusLabel,
  type WorkflowListItemDto,
  type WorkflowListSummary,
  type WorkflowStatus,
} from "./workflows-shared";

type StatusTab = "ALL" | WorkflowStatus;

const PAGE_SIZE = 10;

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All workflows" },
  { id: "PUBLISHED", label: "Published" },
  { id: "DRAFT", label: "Drafts" },
  { id: "UNPUBLISHED", label: "Unpublished" },
];

type ListResponse = {
  data: {
    items: WorkflowListItemDto[];
    summary: WorkflowListSummary;
  };
};
type WorkflowResponse = { data: WorkflowListItemDto };

const EMPTY_SUMMARY: WorkflowListSummary = {
  publishedCount: 0,
  draftCount: 0,
  unpublishedCount: 0,
  totalActiveRuns: 0,
};

function StatusPill({ status }: { status: WorkflowStatus }) {
  const tone =
    status === "PUBLISHED"
      ? "success"
      : status === "DRAFT"
        ? "neutral"
        : "warning";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      <span
        className={[
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          tone === "success"
            ? "bg-[var(--admin-success)]"
            : tone === "warning"
              ? "bg-[var(--admin-warning)]"
              : "bg-[var(--admin-on-surface-variant)]",
        ].join(" ")}
        aria-hidden="true"
      />
      {workflowStatusLabel(status)}
    </span>
  );
}

function WorkflowIcon({ item }: { item: WorkflowListItemDto }) {
  const muted = item.status === "DRAFT" || item.stepCount === 0;
  return (
    <div
      className={[
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
        muted ? "text-[var(--admin-on-surface-variant)]" : "text-[var(--admin-primary)]",
      ].join(" ")}
      aria-hidden="true"
    >
      {item.summaryLabel.toLowerCase().includes("conditional") ? (
        <Split className="h-5 w-5" />
      ) : (
        <Mail className="h-5 w-5" />
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-5" colSpan={6}>
        <div className="h-12 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </td>
    </tr>
  );
}

export function WorkflowsListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<WorkflowListItemDto[]>([]);
  const [summary, setSummary] = useState<WorkflowListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleteRow, setDeleteRow] = useState<WorkflowListItemDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/workflows?${params.toString()}`,
      );
      setItems(response.data.items);
      setSummary(response.data.summary ?? EMPTY_SUMMARY);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load workflows.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, items.length);
  const hasFilters = Boolean(debouncedQuery || tab !== "ALL");
  const deleteMatches =
    deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  async function runAction(id: string, path: string, successMessage: string) {
    setActionBusy(id);
    try {
      const response = await clientApi.post<WorkflowResponse>(
        `/api/v1/marketing/workflows/${id}/${path}`,
        {},
        `workflow-${path}`,
        { successMessage },
      );
      if (path === "clone") {
        router.push(workflowHref(response.data.id));
        return;
      }
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  function rowActions(row: WorkflowListItemDto): DropdownMenuItem[] {
    const actions: DropdownMenuItem[] = [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(workflowHref(row.id));
        },
      },
      {
        key: "clone",
        label: "Clone",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "clone", "Workflow cloned.");
        },
      },
    ];
    if (row.status === "PUBLISHED") {
      actions.push({
        key: "unpublish",
        label: "Unpublish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "unpublish", "Workflow unpublished.");
        },
      });
    } else {
      actions.push({
        key: "publish",
        label: "Publish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "publish", "Workflow published.");
        },
      });
    }
    actions.push({
      key: "delete",
      label: "Delete",
      destructive: true,
      onSelect: () => {
        setDeleteRow(row);
        setDeleteConfirm("");
      },
    });
    return actions;
  }

  async function onDelete() {
    if (!deleteRow || !deleteMatches) {
      toast.error("Type the workflow title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/workflows/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "workflow-delete",
        { successMessage: "Workflow deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not delete workflow.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="relative space-y-8">
      <div
        className="pointer-events-none absolute -right-10 top-8 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] opacity-45 blur-[90px] motion-reduce:hidden"
        aria-hidden="true"
      />

      <Link href={MARKETING_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Marketing
      </Link>

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]"
      >
        <span>Automations</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">Workflows</span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className={managePageTitleClassName}>Workflows</h1>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Automated, event-triggered sequences sent to learners over time. Design multi-step
            journeys based on learner behavior.
          </p>
        </div>
        <Link
          href={WORKFLOWS_CREATE_HREF}
          prefetch={false}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-6 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] shadow-[0_8px_20px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-colors hover:bg-[var(--admin-primary-strong)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create workflow
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
              Published
            </p>
            <p className="text-lg font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {formatWorkflowCount(summary.publishedCount)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
              Active runs
            </p>
            <p className="text-lg font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {formatWorkflowCount(summary.totalActiveRuns)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">Drafts</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {formatWorkflowCount(summary.draftCount)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <PauseCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
              Unpublished
            </p>
            <p className="text-lg font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {formatWorkflowCount(summary.unpublishedCount)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Workflow status"
          className="flex flex-wrap gap-1 border-b border-[var(--admin-border)] lg:border-b-0"
        >
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={[
                  "relative px-3 py-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                  active
                    ? "text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                {entry.label}
                {active ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)] lg:bottom-[-1px]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <label className="sr-only" htmlFor="workflows-search">
            Search workflows
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
            aria-hidden="true"
          />
          <input
            id="workflows-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workflows…"
            className="w-full rounded-lg border-none bg-[var(--admin-surface-low)] py-2 pl-10 pr-4 text-[13px] text-[var(--admin-on-surface)] outline-none ring-1 ring-[var(--admin-border)] transition-[box-shadow] placeholder:text-[var(--admin-on-surface-variant)]/60 focus:ring-2 focus:ring-[var(--admin-primary)]/20"
          />
        </div>
      </div>

      {loading ? (
        <div
          className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <table className="w-full">
            <tbody>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
            <GitBranch className="h-8 w-8 text-[var(--admin-primary)]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
            {hasFilters ? "No workflows found" : "No workflows yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            {hasFilters
              ? "Try adjusting your filters or search terms."
              : "Create a workflow, pick a use case, then publish to start automating."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTab("ALL");
              }}
              className="mt-4 text-sm font-bold text-[var(--admin-primary)] hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <Link
              href={WORKFLOWS_CREATE_HREF}
              prefetch={false}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create workflow
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Workflow title
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Trigger event
                  </th>
                  <th className="px-6 py-4 text-center text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Active runs
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Last updated
                  </th>
                  <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {pageItems.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      "transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]",
                      row.status === "DRAFT" || row.stepCount === 0 ? "opacity-90" : "",
                    ].join(" ")}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <WorkflowIcon item={row} />
                        <div className="min-w-0">
                          <Link
                            href={workflowHref(row.id)}
                            prefetch={false}
                            className="block truncate font-bold text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                          >
                            {row.title}
                          </Link>
                          <p className="truncate text-[13px] text-[var(--admin-on-surface-variant)]">
                            {row.summaryLabel}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                        <Zap className="h-[18px] w-[18px] shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
                        <span className="truncate">{row.triggerLabel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="font-mono text-[12px] font-semibold tabular-nums text-[var(--admin-on-surface)]">
                        {formatWorkflowCount(row.activeRunCount)}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p
                        className="text-[13px] text-[var(--admin-on-surface)]"
                        title={formatWorkflowDateTime(row.updatedAt)}
                      >
                        {formatWorkflowDate(row.updatedAt)}
                      </p>
                      {row.useCaseTitle ? (
                        <p className="truncate text-[10px] text-[var(--admin-on-surface-variant)]">
                          {row.useCaseTitle}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu
                        label={`Actions for ${row.title}`}
                        align="end"
                        trigger={<MoreVertical className="h-4 w-4" aria-hidden="true" />}
                        triggerClassName="rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)]"
                        items={rowActions(row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
              Showing {rangeStart}-{rangeEnd} of {formatWorkflowCount(items.length)} workflows
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[4.5rem] text-center text-[12px] font-bold tabular-nums text-[var(--admin-on-surface)]">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-6 py-10 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <GitBranch className="h-8 w-8 text-[var(--admin-primary)]" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--admin-on-surface)]">
          Build smarter journeys
        </h2>
        <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
          Open a workflow to edit triggers, delays, conditions, and email actions in the builder.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" aria-hidden="true" />
            <p className="text-[12px] font-bold text-[var(--admin-on-surface)]">
              Branch on quiz score
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm">
            <Clock3 className="h-[18px] w-[18px] text-[var(--admin-primary)]" aria-hidden="true" />
            <p className="text-[12px] font-bold text-[var(--admin-on-surface)]">Wait before send</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm">
            <Split className="h-[18px] w-[18px] text-[var(--admin-warning)]" aria-hidden="true" />
            <p className="text-[12px] font-bold text-[var(--admin-on-surface)]">
              Conditional paths
            </p>
          </div>
        </div>
      </div>

      {deleteRow ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close delete dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-[2px]"
            onClick={() => {
              if (!deleteBusy) {
                setDeleteRow(null);
                setDeleteConfirm("");
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workflow-title"
            className={`admin-theme relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl ${dropdownPanelSurfaceClassName}`}
          >
            <div className="space-y-3 p-6">
              <h2
                id="delete-workflow-title"
                className="text-lg font-bold text-[var(--admin-on-surface)]"
              >
                Delete workflow
              </h2>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Type{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">{deleteRow.title}</span>{" "}
                to confirm. Active runs already in progress are not cancelled by this action.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="Workflow title"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-danger)] focus:ring-2 focus:ring-[var(--admin-danger)]/20"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteRow(null);
                  setDeleteConfirm("");
                }}
                className="rounded-lg px-4 py-2 text-[12px] font-bold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => void onDelete()}
                className="rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-[12px] font-bold text-[var(--admin-on-primary)] disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
