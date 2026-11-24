"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { clientApi } from "../../../lib/client-api";
import type { AdminNavItem } from "../admin-navigation";
import {
  ADMIN_SETTINGS_SECTIONS,
  filterAdminSettingsSections,
  flattenAdminSettingsItems,
} from "../settings/admin-settings-catalog";
import {
  ADMIN_SEARCH_MIN_LENGTH,
  courseResult,
  matchAdminPages,
  memberResult,
  type AdminSearchPage,
  type AdminSearchResult,
} from "./admin-header-search";

type MembersResponse = {
  data: {
    items: Array<{
      id: string;
      accountEmail?: string | null;
      invitedEmail?: string | null;
      profile?: { displayName?: string | null } | null;
    }>;
  };
};

type CoursesResponse = {
  data: { items: Array<{ id: string; title: string; status?: string }> };
};

type EntitlementsResponse = { data: Array<{ key: string; enabled: boolean }> };

const GROUP_ORDER: ReadonlyArray<AdminSearchResult["group"]> = ["Pages", "Members", "Courses"];

/**
 * Search members, courses and admin pages from the header (QA review 2 H13:
 * the box did nothing). Pages are matched in the browser; members and
 * courses come from the API once two letters are typed.
 */
export function AdminHeaderSearch({ navigationItems }: { navigationItems: AdminNavItem[] }) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remote, setRemote] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [enabledEntitlements, setEnabledEntitlements] = useState<Set<string> | null>(null);

  // Settings pages the academy's plan includes, loaded the first time the box is used.
  useEffect(() => {
    if (!open || enabledEntitlements) return;
    let cancelled = false;
    void clientApi
      .get<EntitlementsResponse>("/api/v1/entitlements")
      .then((response) => {
        if (!cancelled) {
          setEnabledEntitlements(
            new Set(response.data.filter((entry) => entry.enabled).map((entry) => entry.key)),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setEnabledEntitlements(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [open, enabledEntitlements]);

  const pages = useMemo<AdminSearchPage[]>(() => {
    const fromMenu = navigationItems.map((item) => ({ href: item.href, title: item.label }));
    const settings = enabledEntitlements
      ? flattenAdminSettingsItems(
          filterAdminSettingsSections(ADMIN_SETTINGS_SECTIONS, {
            enabledEntitlements,
            canAccessWorkflowReview: navigationItems.some((item) => item.requiresWorkflowReview),
            canAccessStudio: true,
            canAccessModeration: true,
            canAccessAppealsReview: true,
          }),
        ).map((item) => ({
          href: item.href,
          title: item.title,
          description: item.description,
          ...(item.keywords ? { keywords: item.keywords } : {}),
        }))
      : [];
    return [...fromMenu, ...settings];
  }, [navigationItems, enabledEntitlements]);

  const trimmed = query.trim();
  const searchable = trimmed.length >= ADMIN_SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!searchable) {
      setRemote([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      const members = clientApi
        .get<MembersResponse>(
          `/api/v1/members?${new URLSearchParams({ search: trimmed, limit: "5" }).toString()}`,
        )
        .then((response) => response.data.items.map(memberResult))
        .catch(() => [] as AdminSearchResult[]);
      const courses = clientApi
        .get<CoursesResponse>(
          `/api/v1/courses?${new URLSearchParams({ view: "studio", q: trimmed, limit: "5" }).toString()}`,
        )
        .then((response) => response.data.items.map(courseResult))
        .catch(() => [] as AdminSearchResult[]);
      void Promise.all([members, courses]).then(([memberResults, courseResults]) => {
        if (cancelled) return;
        setRemote([...memberResults, ...courseResults]);
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, searchable]);

  const results = useMemo(() => {
    const all = [...matchAdminPages(trimmed, pages), ...remote];
    return GROUP_ORDER.flatMap((group) => all.filter((result) => result.group === group));
  }, [trimmed, pages, remote]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  function go(result: AdminSearchResult | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  const showPanel = open && searchable;
  const activeResult = results[activeIndex];

  return (
    <div ref={containerRef} className="relative hidden max-w-md flex-1 sm:block">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <label className="sr-only" htmlFor="admin-shell-search">
        Search admin
      </label>
      <input
        id="admin-shell-search"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showPanel && activeResult ? `${listboxId}-${activeResult.id}` : undefined
        }
        autoComplete="off"
        value={query}
        placeholder="Search members, content, or settings"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!showPanel || results.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + results.length) % results.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            go(activeResult);
          }
        }}
        className="w-full rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/40"
      />

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 shadow-lg">
          <ul id={listboxId} role="listbox" aria-label="Search results">
            {GROUP_ORDER.map((group) => {
              const inGroup = results.filter((result) => result.group === group);
              if (inGroup.length === 0) return null;
              return (
                <li key={group} role="presentation">
                  <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {group}
                  </p>
                  <ul role="presentation">
                    {inGroup.map((result) => {
                      const index = results.indexOf(result);
                      const active = index === activeIndex;
                      return (
                        <li
                          key={result.id}
                          id={`${listboxId}-${result.id}`}
                          role="option"
                          aria-selected={active}
                          onPointerEnter={() => {
                            setActiveIndex(index);
                          }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            go(result);
                          }}
                          className={[
                            "mx-2 cursor-pointer rounded-lg px-3 py-2",
                            active
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                              : "",
                          ].join(" ")}
                        >
                          <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                            {result.title}
                          </p>
                          {result.detail ? (
                            <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                              {result.detail}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
          {results.length === 0 ? (
            loading ? (
              <p className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching…
              </p>
            ) : (
              <p className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                Nothing matches &ldquo;{trimmed}&rdquo;. Try a member&apos;s name or email, a course
                title, or a setting.
              </p>
            )
          ) : loading ? (
            <p className="flex items-center gap-2 px-4 pb-1 pt-2 text-xs text-[var(--admin-on-surface-variant)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Searching members and courses…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
