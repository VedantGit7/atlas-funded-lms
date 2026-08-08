"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  Lock,
  LockOpen,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { z } from "zod";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseCatalogCard } from "./course-catalog-card";
import { CreateCourseDialog } from "./create-course-dialog";
import {
  StatCard,
  catalogFilterButtonClassName,
  catalogSearchClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  summarizeCourseCatalogStats,
  type CourseCatalogStatus,
} from "./courses-catalog-shared";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type StatusFilter = "ALL" | CourseCatalogStatus;
type SortOrder = "updated_desc" | "updated_asc" | "title_asc";

type CourseManagerViewProps = {
  courses: CourseRow[];
  canCreate: boolean;
};

export function CourseManagerView({ courses, canCreate }: CourseManagerViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updated_desc");
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const manageRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!manageOpen && !dateMenuOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (manageOpen && manageRef.current && !manageRef.current.contains(target)) {
        setManageOpen(false);
      }
      if (dateMenuOpen && dateRef.current && !dateRef.current.contains(target)) {
        setDateMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [dateMenuOpen, manageOpen]);

  const stats = useMemo(() => summarizeCourseCatalogStats(courses), [courses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    let items = courses.filter((course) => {
      if (!showArchived && course.status === "ARCHIVED") return false;
      if (statusFilter !== "ALL" && course.status !== statusFilter) return false;
      if (!query) return true;
      return (
        course.title.toLowerCase().includes(query) ||
        course.slug.toLowerCase().includes(query) ||
        (course.description?.toLowerCase().includes(query) ?? false)
      );
    });

    items = [...items].sort((a, b) => {
      if (sortOrder === "title_asc") {
        return a.title.localeCompare(b.title);
      }

      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortOrder === "updated_asc" ? aTime - bTime : bTime - aTime;
    });

    return items;
  }, [courses, search, showArchived, sortOrder, statusFilter]);

  const sortLabel =
    sortOrder === "updated_desc"
      ? "Newest first"
      : sortOrder === "updated_asc"
        ? "Oldest first"
        : "Title A–Z";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
            Courses
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Welcome to your course dashboard
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div ref={manageRef} className="relative">
            <button
              type="button"
              aria-expanded={manageOpen}
              onClick={() => {
                setManageOpen((open) => !open);
                setDateMenuOpen(false);
              }}
              className={`${outlineButtonClassName} inline-flex items-center gap-2 px-4 py-2.5`}
            >
              Manage
              <ChevronDown
                className={[
                  "h-4 w-4 transition-transform duration-200",
                  manageOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
            {manageOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
                <button
                  type="button"
                  className="flex w-full px-4 py-2.5 text-left text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setShowArchived((value) => !value);
                    setManageOpen(false);
                  }}
                >
                  {showArchived ? "Hide archived" : "Show archived"}
                </button>
                <button
                  type="button"
                  className="flex w-full px-4 py-2.5 text-left text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearch("");
                    setSortOrder("updated_desc");
                    setManageOpen(false);
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>

          {canCreate ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
              }}
              className={`${primaryButtonClassName} px-5 py-2.5`}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Create
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="course-catalog-search">
            Search by title
          </label>
          <input
            id="course-catalog-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search by Title"
            className={catalogSearchClassName}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen((open) => !open);
              setDateMenuOpen(false);
              setManageOpen(false);
            }}
            className={catalogFilterButtonClassName}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
          </button>

          <div ref={dateRef} className="relative">
            <button
              type="button"
              aria-expanded={dateMenuOpen}
              onClick={() => {
                setDateMenuOpen((open) => !open);
                setFiltersOpen(false);
                setManageOpen(false);
              }}
              className={catalogFilterButtonClassName}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Published Date
            </button>
            {dateMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[11rem] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
                {(
                  [
                    ["updated_desc", "Newest first"],
                    ["updated_asc", "Oldest first"],
                    ["title_asc", "Title A–Z"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={[
                      "flex w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--admin-surface-high)]",
                      sortOrder === value
                        ? "font-semibold text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface)]",
                    ].join(" ")}
                    onClick={() => {
                      setSortOrder(value);
                      setDateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 motion-safe:animate-[admin-banner-in_0.2s_ease-out]">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Status
          </span>
          {(
            [
              ["ALL", "All"],
              ["PUBLISHED", "Published"],
              ["DRAFT", "Unpublished"],
              ["REVIEW", "In review"],
              ["ARCHIVED", "Archived"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatusFilter(value);
              }}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                statusFilter === value
                  ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                  : "bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--admin-on-surface-variant)]">
            Sorted by {sortLabel.toLowerCase()}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Course" value={stats.total} icon={BookOpen} />
        <StatCard label="Published" value={stats.published} icon={Lock} />
        <StatCard label="Unpublished" value={stats.unpublished} icon={LockOpen} />
        <StatCard label="In review" value={stats.inReview} icon={Clock} />
      </div>

      {filteredCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-16 text-center">
          <BookOpen
            className="mx-auto h-10 w-10 text-[var(--admin-on-surface-variant)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-[var(--admin-on-surface)]">No courses found</h2>
          <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
            {courses.length === 0
              ? "Create your first course to start building curriculum."
              : "Try adjusting your search or filters."}
          </p>
          {canCreate && courses.length === 0 ? (
            <button
              type="button"
              className={`${primaryButtonClassName} mt-6`}
              onClick={() => {
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create course
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <CourseCatalogCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {showCreate ? (
        <CreateCourseDialog
          onClose={() => {
            setShowCreate(false);
          }}
        />
      ) : null}
    </div>
  );
}
