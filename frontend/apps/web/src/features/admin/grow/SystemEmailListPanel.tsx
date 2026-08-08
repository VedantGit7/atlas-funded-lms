"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  PencilLine,
  Search,
  Shield,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
} from "../manage/manage-ui-shared";
import {
  TRANSACTIONAL_EMAIL_SETTINGS_HREF,
  formatSystemEmailCategory,
  formatSystemEmailDate,
  systemEmailHref,
  type SystemEmailDto,
} from "./system-email-shared";

const MESSENGER_HREF = "/admin/marketing/messenger";
const PAGE_SIZE = 10;

type CategoryFilter = "ALL" | "certificates" | "security";

type ListResponse = { data: { items: SystemEmailDto[] } };

const CATEGORY_CHIPS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "certificates", label: "Certificates" },
  { id: "security", label: "Security" },
];

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    />
  );
}

function StatusCell({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "h-2.5 w-2.5 rounded-full",
          enabled
            ? "bg-[var(--admin-success)]"
            : "bg-[var(--admin-on-surface-variant)]/45",
        ].join(" ")}
        aria-hidden="true"
      />
      <span
        className={[
          "text-[12px] font-bold uppercase tracking-[0.04em]",
          enabled
            ? "text-[var(--admin-success)]"
            : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}

function CategoryPill({ category }: { category: SystemEmailDto["category"] }) {
  const isCertificates = category === "certificates";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        isCertificates
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {isCertificates ? (
        <Award className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {formatSystemEmailCategory(category)}
    </span>
  );
}

export function SystemEmailListPanel() {
  const [items, setItems] = useState<SystemEmailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<ListResponse>("/api/v1/marketing/system-emails");
      setItems(response.data.items);
    } catch (caught) {
      setItems([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load system emails.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = debouncedQuery.toLowerCase();
    return items.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (!normalized) return true;
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.key.toLowerCase().includes(normalized)
      );
    });
  }, [items, debouncedQuery, category]);

  const enabledCount = useMemo(
    () => items.filter((item) => item.enabled).length,
    [items],
  );
  const customizedCount = useMemo(
    () => items.filter((item) => item.isCustomized).length,
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-10 top-8 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] opacity-50 blur-[90px] motion-reduce:hidden"
        aria-hidden="true"
      />

      <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Messenger Hub
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className={managePageTitleClassName}>System Email</h1>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Automated emails triggered by certificate and security events. Customize copy and
            delivery - these templates cannot be deleted.
          </p>
        </div>
        <Link
          href={TRANSACTIONAL_EMAIL_SETTINGS_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-primary)] transition-transform hover:underline group"
        >
          Sender identity settings
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-safe:duration-200"
            aria-hidden="true"
          />
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Catalog
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-[var(--admin-on-surface)]">
            {items.length}
          </p>
          <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
            Built-in system emails
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Enabled
          </p>
          <p className="mt-2 flex items-baseline gap-2 text-2xl font-extrabold tabular-nums text-[var(--admin-success)]">
            {enabledCount}
            <span className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              / {items.length}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
            Currently sending to learners
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Customized
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-[var(--admin-warning)]">
            {customizedCount}
          </p>
          <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
            Edited from platform defaults
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
        <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div
            role="tablist"
            aria-label="System email category"
            className="flex flex-wrap items-center gap-2"
          >
            {CATEGORY_CHIPS.map((chip) => {
              const active = category === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setCategory(chip.id);
                  }}
                  className={[
                    "rounded-full px-4 py-1.5 text-[12px] font-bold tracking-[0.02em] transition-[background-color,color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                    active
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
                      : "border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] hover:border-[color-mix(in_srgb,var(--admin-primary)_40%,var(--admin-border))]",
                  ].join(" ")}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:max-w-sm">
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
              placeholder="Search system emails..."
              aria-label="Search system emails"
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 p-6" aria-busy="true" aria-live="polite">
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
              <Mail className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold text-[var(--admin-on-surface)]">
              No system emails match
            </p>
            <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Try another search term or clear the category filter.
            </p>
            <button
              type="button"
              className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setQuery("");
                setCategory("ALL");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      Email
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      Category
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      Customized
                    </th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                      Last updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {pageItems.map((item) => (
                    <tr
                      key={item.key}
                      className="transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface))]"
                    >
                      <td className="px-6 py-5">
                        <Link
                          href={systemEmailHref(item.key)}
                          prefetch={false}
                          className="group block focus-visible:outline-none"
                        >
                          <span className="font-semibold text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)] group-focus-visible:text-[var(--admin-primary)]">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                            {item.description}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-5">
                        <CategoryPill category={item.category} />
                      </td>
                      <td className="px-6 py-5">
                        <StatusCell enabled={item.enabled} />
                      </td>
                      <td className="px-6 py-5">
                        {item.isCustomized ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium italic text-[var(--admin-warning)]">
                            <PencilLine className="h-4 w-4" aria-hidden="true" />
                            Edited
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-[12px] tabular-nums text-[var(--admin-on-surface-variant)]">
                        {formatSystemEmailDate(item.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                Showing {rangeStart}-{rangeEnd} of {filtered.length} system email
                {filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-[4.5rem] text-center text-[12px] font-bold tabular-nums text-[var(--admin-on-surface-variant)]">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => {
                    setPage((current) => Math.min(totalPages, current + 1));
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-4">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
          aria-hidden="true"
        />
        <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
          System emails are event-driven and stay in the catalog permanently. Open a row to edit
          subject and body, toggle delivery, or send a test message.
        </p>
      </div>
    </div>
  );
}
