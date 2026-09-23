"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, CalendarClock, Columns3, Search, SlidersHorizontal } from "lucide-react";

import type {
  ContentTrashActivityItem,
  ContentTrashActivityResponse,
} from "@atlas/contracts/content-trash/content-trash.contract";

import { clientApi } from "../../../lib/client-api";

function ActivityEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 180"
      className="mx-auto h-36 w-auto"
      role="img"
      aria-label="No activity results illustration"
    >
      <ellipse cx="120" cy="158" rx="70" ry="8" className="fill-[var(--admin-surface-high)]" />
      <path
        d="M78 78h84v62H78V78Z"
        className="fill-[var(--admin-surface)] stroke-[var(--admin-outline)]"
        strokeWidth="2"
      />
      <path d="M78 98h84" className="stroke-[var(--admin-border)]" strokeWidth="2" />
      <path
        d="M95 98c0 18 12 30 25 30s25-12 25-30"
        className="fill-[var(--admin-surface-high)] stroke-[var(--admin-outline)]"
        strokeWidth="1.5"
      />
      <circle cx="112" cy="112" r="3" className="fill-[var(--admin-success)]" />
      <circle cx="128" cy="110" r="2.5" className="fill-[var(--admin-success)]" />
      <path
        d="M108 70c6-10 18-10 24 0"
        className="stroke-[var(--admin-on-surface-variant)]"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx="120"
        cy="62"
        r="10"
        className="fill-[var(--admin-surface)] stroke-[var(--admin-outline)]"
        strokeWidth="2"
      />
      <path
        d="M162 88l8-4v20l-8 4V88Z"
        className="fill-[var(--admin-success)]/40 stroke-[var(--admin-success)]"
        strokeWidth="1.5"
      />
      <path
        d="M70 120c-8 2-14-4-12-10 4-2 8 0 12 4"
        className="stroke-[var(--admin-success)]"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M168 70c6-2 10 2 8 8"
        className="stroke-[var(--admin-on-surface-variant)]"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TrashActivityLogPanel({
  initialItems,
}: {
  initialItems: ContentTrashActivityItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleItems = useMemo(() => {
    const needle = submittedQuery.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.adminName.toLowerCase().includes(needle));
  }, [items, submittedQuery]);

  const runSearch = (value: string) => {
    const next = value.trim();
    setSubmittedQuery(next);
    setError(null);
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (next) params.set("q", next);
        const response = await clientApi.get<ContentTrashActivityResponse>(
          `/api/v1/content-trash/activity?${params.toString()}`,
        );
        setItems(response.data.items);
      } catch {
        setError("Could not load activity. Try again.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/trash"
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Back
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]">
        Activity Log
      </h1>

      <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <form
            className="relative w-full max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(query);
            }}
          >
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
              placeholder="Search by Admin"
              aria-label="Search by admin"
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)]"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
              Columns
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)]/50 px-2.5 py-1.5 text-xs font-semibold">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              TimeStamp
            </span>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mx-4 mt-4 rounded-lg border border-[var(--admin-danger)]/40 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)] sm:mx-6"
          >
            {error}
          </p>
        ) : null}

        <div className="min-h-[380px] px-4 py-10 sm:px-6">
          {pending ? (
            <p className="py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
              Searching…
            </p>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center motion-safe:animate-[admin-dropdown-in_0.28s_cubic-bezier(0.16,1,0.3,1)]">
              <ActivityEmptyIllustration />
              <p className="mt-4 text-base font-semibold text-[var(--admin-on-surface)]">
                No results found
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {item.actionLabel}
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {item.adminName}
                      {item.targetId ? ` · ${item.targetType} ${item.targetId.slice(0, 8)}` : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                    {formatTimestamp(item.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
