"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreVertical,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  CONTACTS_HREF,
  FORMS_CREATE_HREF,
  formHref,
  formKindLabel,
  formShareSubtitle,
  formStatusLabel,
  formSubmissionsHref,
  formatFormCount,
  formatFormRelativeTime,
  type FormDto,
  type FormKind,
  type FormListSummary,
  type FormStatus,
} from "./forms-shared";

type StatusTab = "ALL" | FormStatus;

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Live" },
  { id: "DRAFT", label: "Draft" },
  { id: "UNPUBLISHED", label: "Unpublished" },
];

type ListResponse = {
  data: {
    items: FormDto[];
    summary: FormListSummary;
  };
};
type FormResponse = { data: FormDto };

const EMPTY_SUMMARY: FormListSummary = {
  liveCount: 0,
  draftCount: 0,
  unpublishedCount: 0,
  totalCount: 0,
};

function StatusPill({ status }: { status: FormStatus }) {
  const tone =
    status === "LIVE" ? "success" : status === "UNPUBLISHED" ? "warning" : "neutral";
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "h-2 w-2 rounded-full",
          tone === "success"
            ? "bg-[var(--admin-success)]"
            : tone === "warning"
              ? "bg-[var(--admin-warning)]"
              : "bg-[var(--admin-on-surface-variant)]",
        ].join(" ")}
        aria-hidden="true"
      />
      <span
        className={[
          "text-[11px] font-bold",
          tone === "success"
            ? "text-[var(--admin-success)]"
            : tone === "warning"
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {formStatusLabel(status)}
      </span>
    </div>
  );
}

function KindPill({ kind }: { kind: FormKind }) {
  const lead = kind === "LEAD";
  return (
    <span
      className={[
        "inline-flex rounded px-2 py-1 text-[11px] font-bold",
        lead
          ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)] uppercase"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {formKindLabel(kind)}
    </span>
  );
}

function FormIcon({ form }: { form: FormDto }) {
  const muted = form.status !== "LIVE";
  const Icon =
    form.kind === "SIGNUP" ? UserPlus : form.status === "DRAFT" ? FileText : Download;
  return (
    <div
      className={[
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        muted
          ? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
          : "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]",
      ].join(" ")}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
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

export function FormsListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<FormDto[]>([]);
  const [summary, setSummary] = useState<FormListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<FormDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => { window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [tab, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/forms?${params.toString()}`,
        "forms-list",
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load forms.");
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, items.length);
  const hasFilters = Boolean(debouncedQuery || tab !== "ALL");
  const deleteMatches =
    deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  async function runAction(id: string, path: string, successMessage: string) {
    setActionBusy(id);
    try {
      await clientApi.post<FormResponse>(
        `/api/v1/marketing/forms/${id}/${path}`,
        {},
        `form-${path}`,
        { successMessage },
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  function rowActions(row: FormDto): DropdownMenuItem[] {
    const actions: DropdownMenuItem[] = [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(formHref(row.id));
        },
      },
      {
        key: "submissions",
        label: "Submissions",
        onSelect: () => {
          router.push(formSubmissionsHref(row.id));
        },
      },
      {
        key: "copy-link",
        label: "Copy public link",
        disabled: row.status !== "LIVE",
        onSelect: () => {
          const url =
            typeof window !== "undefined"
              ? `${window.location.origin}${row.sharePath}`
              : row.sharePath;
          void navigator.clipboard.writeText(url).then(
            () => {
              toast.success("Public link copied.");
            },
            () => {
              toast.error("Could not copy link.");
            },
          );
        },
      },
    ];
    if (row.status === "LIVE") {
      actions.push({
        key: "unpublish",
        label: "Unpublish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "unpublish", "Form unpublished.");
        },
      });
    } else {
      actions.push({
        key: "publish",
        label: "Publish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "publish", "Form published.");
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
    if (!deleteRow) return;
    if (deleteConfirm.trim() !== deleteRow.title.trim()) {
      toast.error("Type the form title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/forms/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "form-delete",
        { successMessage: "Form deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete form.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setTab("ALL");
    setPage(1);
  }

  const tabCount = (id: StatusTab): number => {
    if (id === "ALL") return summary.totalCount;
    if (id === "LIVE") return summary.liveCount;
    if (id === "DRAFT") return summary.draftCount;
    return summary.unpublishedCount;
  };

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-primary)]"
          >
            <Link
              href={CONTACTS_HREF}
              prefetch={false}
              className="inline-flex items-center gap-1 hover:underline"
            >
              Contacts
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </nav>
          <h1 className="text-[32px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Forms
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Capture leads and signups. Publish live, share a link, then review submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={CONTACTS_HREF}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Contacts
          </Link>
          <Link
            href={FORMS_CREATE_HREF}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-95"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Create form
          </Link>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:flex-row md:items-center">
        <div className="relative w-full md:w-96">
          <label htmlFor="forms-search" className="sr-only">
            Search forms
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id="forms-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search forms..."
            className="w-full rounded-lg border-none bg-[var(--admin-surface-low)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none ring-0 transition-[box-shadow] placeholder:text-[var(--admin-on-surface-variant)]/55 focus:ring-2 focus:ring-[var(--admin-primary)]/20"
          />
        </div>
        <div
          role="tablist"
          aria-label="Form status"
          className="flex w-full items-center gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1 md:w-auto"
        >
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(entry.id);
                }}
                className={[
                  "rounded-md px-4 py-1.5 text-[12px] font-bold transition-colors",
                  active
                    ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:bg-[color-mix(in_srgb,var(--admin-surface)_50%,transparent)]",
                ].join(" ")}
              >
                {entry.label}
                <span className="ml-1.5 text-[10px] font-semibold opacity-70">
                  {formatFormCount(tabCount(entry.id))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading || items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_30%,transparent)]">
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Title
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Kind
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Submissions
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Updated
                  </th>
                  <th className="w-10 px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <SkeletonRow key={`skeleton-${String(index)}`} />
                    ))
                  : pageItems.map((row) => {
                      const muted = row.status !== "LIVE";
                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary-container)_30%,transparent)]"
                          onClick={() => {
                            router.push(formHref(row.id));
                          }}
                        >
                          <td className="px-6 py-5">
                            <div
                              className={[
                                "flex items-center gap-3",
                                muted ? "opacity-80" : "",
                              ].join(" ")}
                            >
                              <FormIcon form={row} />
                              <div className="min-w-0">
                                <p className="truncate font-bold text-[var(--admin-on-surface)]">
                                  {row.title}
                                </p>
                                <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {formShareSubtitle(row)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <KindPill kind={row.kind} />
                          </td>
                          <td className="px-6 py-5">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="px-6 py-5 text-right font-mono text-xs tabular-nums text-[var(--admin-on-surface)]">
                            <Link
                              href={formSubmissionsHref(row.id)}
                              prefetch={false}
                              className="font-semibold text-[var(--admin-primary)] underline-offset-4 hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {formatFormCount(row.submissionCount)}
                            </Link>
                          </td>
                          <td className="px-6 py-5 text-[13px] text-[var(--admin-on-surface-variant)]">
                            <time dateTime={row.updatedAt} title={row.updatedAt}>
                              {formatFormRelativeTime(row.updatedAt)}
                            </time>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <DropdownMenu
                                label={`Actions for ${row.title}`}
                                align="end"
                                trigger={<MoreVertical className="h-4 w-4" aria-hidden="true" />}
                                triggerClassName="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                items={rowActions(row)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {!loading ? (
            <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_20%,transparent)] px-6 py-4 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {formatFormCount(rangeStart)}-{formatFormCount(rangeEnd)} of{" "}
                {formatFormCount(items.length)} forms
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-[10rem] items-center gap-2">
                  <span className="whitespace-nowrap text-xs">Rows per page</span>
                  <div className="min-w-[4.5rem]">
                    <AdminSelectDropdown
                      id="forms-page-size"
                      label={null}
                      ariaLabel="Rows per page"
                      value={String(pageSize)}
                      options={[...PAGE_SIZE_OPTIONS]}
                      onChange={(value) => {
                        setPageSize(Number(value) || 10);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    className="rounded p-1 transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="min-w-[1.5rem] text-center font-bold text-[var(--admin-on-surface)]">
                    {formatFormCount(safePage)}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => {
                      setPage((current) => Math.min(totalPages, current + 1));
                    }}
                    className="rounded p-1 transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-20 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
            <FileText className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-[var(--admin-on-surface)]">
            {hasFilters ? "No forms match your filters" : "No forms yet"}
          </h2>
          <p className="mb-8 max-w-sm text-[var(--admin-on-surface-variant)]">
            {hasFilters
              ? "Try a different search or status tab, or clear filters to see all forms."
              : "Start capturing leads and feedback by creating your first interactive form."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-border)] px-8 py-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
            >
              Clear filters
            </button>
          ) : (
            <Link
              href={FORMS_CREATE_HREF}
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-primary)] px-8 py-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-on-primary)] shadow-[0_12px_28px_color-mix(in_srgb,var(--admin-primary)_20%,transparent)] transition-all hover:bg-[var(--admin-primary-strong)]"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Create your first form
            </Link>
          )}
        </div>
      )}

      {deleteRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-delete-title"
          >
            <h2
              id="form-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete form
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{deleteRow.title}</span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm form title"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
                onClick={() => {
                  setDeleteRow(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => {
                  void onDelete();
                }}
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
