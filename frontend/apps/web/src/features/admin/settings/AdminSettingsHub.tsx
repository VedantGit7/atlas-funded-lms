"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { AdminSettingsItem, AdminSettingsSection } from "./admin-settings-catalog";
import { adminSettingsIcon } from "./admin-settings-icons";

type AdminSettingsHubProps = {
  sections: AdminSettingsSection[];
  academyName: string;
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function itemMatchesQuery(item: AdminSettingsItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.title,
    item.description,
    ...(item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function SettingsCard({ item }: { item: AdminSettingsItem }) {
  const Icon = adminSettingsIcon(item.iconKey);
  return (
    <Link
      href={item.href}
      className="group flex h-full gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] motion-safe:active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] transition-colors group-hover:bg-[var(--admin-primary)]/15 group-hover:text-[var(--admin-primary)]">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">{item.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {item.description}
        </p>
      </div>
    </Link>
  );
}

function SettingsSectionBlock({
  section,
  query,
}: {
  section: AdminSettingsSection;
  query: string;
}) {
  const visibleItems = section.items.filter((item) => itemMatchesQuery(item, query));
  if (visibleItems.length === 0) return null;

  return (
    <section aria-labelledby={`settings-section-${section.id}`} className="space-y-4">
      <div>
        <h2
          id={`settings-section-${section.id}`}
          className="text-base font-bold text-[var(--admin-on-surface)]"
        >
          {section.title}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">{section.description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <SettingsCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function AdminSettingsHub({ sections, academyName }: AdminSettingsHubProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeQuery(query);

  const visibleSectionCount = useMemo(
    () =>
      sections.filter((section) =>
        section.items.some((item) => itemMatchesQuery(item, normalizedQuery)),
      ).length,
    [normalizedQuery, sections],
  );

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.altKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusSearch]);

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">Settings</h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Manage {academyName} settings and preferences.
        </p>
      </header>

      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search settings"
          aria-label="Search settings"
          className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2.5 pl-10 pr-24 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-[10px] font-medium text-[var(--admin-on-surface-variant)] sm:inline-flex">
          Alt+K
        </kbd>
      </div>

      {visibleSectionCount === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-12 text-center"
        >
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">No settings match your search.</p>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Try a different keyword or clear the search field.
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-[var(--admin-primary)] underline-offset-2 hover:underline"
            onClick={() => {
              setQuery("");
              focusSearch();
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {sections.map((section) => (
            <SettingsSectionBlock key={section.id} section={section} query={normalizedQuery} />
          ))}
        </div>
      )}
    </div>
  );
}
