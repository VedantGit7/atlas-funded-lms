"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { fieldClassName } from "./course-builder-shared";
import { CourseSettingsHubCard } from "./course-settings-hub-card";
import { filterCourseSettingsGroups } from "./course-settings-metadata";

type CourseSettingsHubProps = {
  courseId: string;
};

function settingsCardHref(courseId: string, cardId: string, externalHref?: string): string {
  if (externalHref) return externalHref;
  return `/studio/courses/${courseId}/settings?section=${cardId}`;
}

export function CourseSettingsHub({ courseId }: CourseSettingsHubProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => filterCourseSettingsGroups(query), [query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
          Course Settings
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)] md:text-base">
          Manage course settings and preferences
        </p>
      </header>

      <div className="relative mb-10 max-w-2xl">
        <label htmlFor="course-settings-search" className="sr-only">
          Search course settings
        </label>
        <input
          id="course-settings-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search settings"
          className={`${fieldClassName} w-full pr-11`}
        />
        <Search
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>

      <div className="space-y-12">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`course-settings-group-${group.id}`}>
            <div className="mb-5">
              <h2
                id={`course-settings-group-${group.id}`}
                className="text-lg font-bold text-[var(--admin-on-surface)]"
              >
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {group.subtitle}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => (
                <CourseSettingsHubCard
                  key={card.id}
                  card={card}
                  courseId={courseId}
                  href={settingsCardHref(courseId, card.id, card.externalHref?.(courseId))}
                />
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No settings match your search.
          </p>
        ) : null}
      </div>
    </div>
  );
}
