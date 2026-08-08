"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Search, Share2 } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { memberInitials } from "../../studio/courses/admin-form-dropdown-shared";
import {
  FORMS_LIST_HREF,
  answerDisplayValue,
  formHref,
  formSubmissionSourceLabel,
  formatFormCount,
  formatFormRelativeTime,
  type FormDto,
  type FormSubmissionDto,
} from "./forms-shared";

const PAGE_SIZE = 10;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function FormsSubmissionsPanel({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDto | null>(null);
  const [items, setItems] = useState<FormSubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [formRes, subsRes] = await Promise.all([
        clientApi.get<{ data: FormDto }>(`/api/v1/marketing/forms/${formId}`, "form-get"),
        clientApi.get<{ data: { items: FormSubmissionDto[] } }>(
          `/api/v1/marketing/forms/${formId}/submissions`,
          "form-submissions",
        ),
      ]);
      setForm(formRes.data);
      setItems(subsRes.data.items);
      setExpandedId(subsRes.data.items[0]?.id ?? null);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load submissions.",
      );
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) => {
      const haystack = [
        row.email,
        row.displayName ?? "",
        row.source,
        ...Object.values(row.answers).map((value) => answerDisplayValue(value)),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  function exportCsv() {
    if (!form || filtered.length === 0) {
      toast.error("No submissions to export.");
      return;
    }
    const fieldKeys = form.fields.map((field) => field.key);
    const headers = [
      "Email",
      "Name",
      "Source",
      "Submitted",
      ...form.fields.map((field) => field.label),
    ];
    const lines = [
      headers.map(csvEscape).join(","),
      ...filtered.map((row) => {
        const cells = [
          row.email,
          row.displayName ?? "",
          row.source,
          row.createdAt,
          ...fieldKeys.map((key) => answerDisplayValue(row.answers[key])),
        ];
        return cells.map((cell) => csvEscape(cell)).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${form.title.replaceAll(/[^\w.-]+/g, "-").toLowerCase() || "form"}-submissions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded.");
  }

  async function copyShareLink() {
    if (!form || form.status !== "LIVE") {
      toast.error("Publish the form before sharing.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${form.sharePath}`);
      toast.success("Form link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[var(--admin-on-surface-variant)]"
          >
            <Link
              href={FORMS_LIST_HREF}
              prefetch={false}
              className="hover:text-[var(--admin-primary)]"
            >
              Forms
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link
              href={formHref(formId)}
              prefetch={false}
              className="text-[var(--admin-primary)] hover:underline"
            >
              {form?.title ?? "Form"}
            </Link>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Submissions{" "}
            <span className="font-normal text-[var(--admin-on-surface-variant)]">
              ({formatFormCount(items.length)})
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Review responses for this form. Export includes up to the latest 100 loaded rows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void copyShareLink();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share form
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] shadow-sm transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <label htmlFor="submissions-search" className="sr-only">
          Search submissions
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <input
          id="submissions-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search submissions..."
          className="w-full rounded-lg border-none bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/20"
        />
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`sk-${String(index)}`}
              className="h-16 animate-pulse rounded-xl bg-[var(--admin-surface-high)]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-20 text-center">
          <FileText className="mb-6 h-16 w-16 text-[var(--admin-outline)]" aria-hidden="true" />
          <h2 className="mb-2 text-2xl font-semibold text-[var(--admin-on-surface)]">
            No submissions yet
          </h2>
          <p className="mb-8 max-w-md text-[var(--admin-on-surface-variant)]">
            Your form is ready to capture leads. Once someone fills it out, their details appear
            here.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                void copyShareLink();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-primary)] px-6 py-2.5 text-[12px] font-bold text-[var(--admin-primary)]"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share form
            </button>
            <Link
              href={formHref(formId)}
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)]"
            >
              Open builder
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No submissions match your search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)]">
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Respondent
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Email
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Source
                  </th>
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Date submitted
                  </th>
                  <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {pageItems.map((row) => {
                  const expanded = expandedId === row.id;
                  const label = row.displayName?.trim() || row.email;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={[
                          "transition-colors hover:bg-[var(--admin-surface-low)]",
                          expanded
                            ? "bg-[color-mix(in_srgb,var(--admin-surface-low)_30%,transparent)]"
                            : "",
                        ].join(" ")}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-bold text-[var(--admin-on-primary-container)]">
                              {memberInitials(row.displayName, row.email)}
                            </div>
                            <div>
                              <p className="font-semibold text-[var(--admin-on-surface)]">
                                {label}
                              </p>
                              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                                ID: {row.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                          {row.email}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                            {formSubmissionSourceLabel(row.source)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                          <time dateTime={row.createdAt}>
                            {formatFormRelativeTime(row.createdAt)}
                          </time>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            className="rounded px-4 py-1.5 text-[12px] font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                            onClick={() => {
                              setExpandedId((current) => (current === row.id ? null : row.id));
                            }}
                          >
                            {expanded ? "Hide details" : "View details"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-[color-mix(in_srgb,var(--admin-surface-low)_20%,transparent)]">
                          <td className="px-6 py-0" colSpan={5}>
                            <div className="my-4 ml-6 rounded-r-xl border border-[var(--admin-border)] border-l-4 border-l-[var(--admin-primary)] bg-[var(--admin-surface)] py-5 pl-6 pr-5 shadow-sm">
                              <h3 className="mb-4 text-lg font-semibold text-[var(--admin-on-surface)]">
                                Response details
                              </h3>
                              <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
                                {(form?.fields ?? []).map((field) => (
                                  <div key={field.id} className="space-y-1">
                                    <p className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
                                      {field.label}
                                    </p>
                                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                                      {answerDisplayValue(row.answers[field.key])}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_20%,transparent)] px-6 py-4 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {formatFormCount(rangeStart)}-{formatFormCount(rangeEnd)}
              </span>{" "}
              of {formatFormCount(filtered.length)} submissions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="rounded p-1 hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
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
                className="rounded p-1 hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
