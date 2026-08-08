"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { memberInitials } from "../../studio/courses/admin-form-dropdown-shared";
import {
  FORMS_LIST_HREF,
  formHref,
  formatFormCount,
  formatFormRelativeTime,
  type ContactDto,
  type ContactsListSummary,
} from "./forms-shared";

const PAGE_SIZE = 10;

type ListResponse = {
  data: {
    items: ContactDto[];
    summary: ContactsListSummary;
  };
};

export function FormsContactsPanel() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<ContactDto[]>([]);
  const [summary, setSummary] = useState<ContactsListSummary>({ totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 250);
    return () => { window.clearTimeout(timer); };
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (debounced) params.set("q", debounced);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/contacts?${params.toString()}`,
        "contacts-list",
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary({ totalCount: 0 });
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

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
            className="mb-1 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]"
          >
            <Link href={FORMS_LIST_HREF} prefetch={false} className="hover:text-[var(--admin-primary)]">
              Directory
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-[var(--admin-primary)]">All contacts</span>
          </nav>
          <h1 className="text-[32px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Contacts
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Manage prospects captured from forms
            {summary.totalCount > 0
              ? ` (${formatFormCount(summary.totalCount)} total)`
              : ""}
            .
          </p>
        </div>
        <Link
          href={FORMS_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-4 py-2 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to forms
        </Link>
      </div>

      <div className="relative max-w-md">
        <label htmlFor="contacts-search" className="sr-only">
          Search contacts
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--admin-outline)]"
          aria-hidden="true"
        />
        <input
          id="contacts-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search contacts, emails..."
          className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-all focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20"
        />
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`contact-sk-${String(index)}`}
              className="h-14 animate-pulse rounded-xl bg-[var(--admin-surface-high)]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-20 text-center">
          <Users className="mb-6 h-16 w-16 text-[var(--admin-outline)]" aria-hidden="true" />
          <h2 className="mb-2 text-2xl font-semibold text-[var(--admin-on-surface)]">
            {debounced ? "No contacts match your search" : "No contacts yet"}
          </h2>
          <p className="max-w-md text-[var(--admin-on-surface-variant)]">
            {debounced
              ? "Try a different search term."
              : "Contacts appear here when someone submits a marketing form."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Name
                  </th>
                  <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Email
                  </th>
                  <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Associated forms
                  </th>
                  <th className="px-6 py-4 text-center text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Submissions
                  </th>
                  <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Last activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {pageItems.map((row) => {
                  const name = row.displayName?.trim() || row.email;
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[var(--admin-surface-low)]"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-bold text-[var(--admin-on-primary-container)]">
                            {memberInitials(row.displayName, row.email)}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--admin-on-surface)]">{name}</p>
                            {row.phone ? (
                              <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                                {row.phone}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[var(--admin-on-surface-variant)]">
                        {row.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {row.associatedForms.length === 0 ? (
                            <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                              —
                            </span>
                          ) : (
                            row.associatedForms.slice(0, 3).map((form) => (
                              <Link
                                key={form.id}
                                href={formHref(form.id)}
                                prefetch={false}
                                className="rounded-full border border-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))]"
                              >
                                {form.title}
                              </Link>
                            ))
                          )}
                          {row.associatedForms.length > 3 ? (
                            <span className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                              +{String(row.associatedForms.length - 3)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex rounded-lg bg-[var(--admin-surface-high)] px-2.5 py-1 font-mono text-sm text-[var(--admin-on-surface)]">
                          {formatFormCount(row.submissionCount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[13px] text-[var(--admin-on-surface-variant)]">
                        <time dateTime={row.updatedAt}>
                          {formatFormRelativeTime(row.updatedAt)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {formatFormCount(rangeStart)}-{formatFormCount(rangeEnd)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {formatFormCount(items.length)}
              </span>{" "}
              contacts
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
              >
                Previous
              </button>
              <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-sm font-medium text-[var(--admin-on-primary)]">
                {formatFormCount(safePage)}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
