"use client";

import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";

export type CourseFilterValues = {
  q?: string;
  stage?: string;
  dimension?: string;
  persona?: string;
  certificate?: string;
  sort?: string;
};

type CourseFiltersProps = {
  initialFilters: CourseFilterValues;
};

export function CourseFilters({ initialFilters }: CourseFiltersProps) {
  const router = useRouter();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const key of ["q", "stage", "dimension", "persona", "certificate", "sort"] as const) {
      const raw = formData.get(key);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value) params.set(key, value);
    }

    router.push(params.size > 0 ? `/courses?${params.toString()}` : "/courses");
  }

  return (
    <form
      className="grid gap-3 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3"
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>Search</span>
        <input
          name="q"
          type="search"
          defaultValue={initialFilters.q ?? ""}
          placeholder="Search courses"
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Stage</span>
        <input
          name="stage"
          type="text"
          defaultValue={initialFilters.stage ?? ""}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Dimension</span>
        <input
          name="dimension"
          type="text"
          defaultValue={initialFilters.dimension ?? ""}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Persona</span>
        <input
          name="persona"
          type="text"
          defaultValue={initialFilters.persona ?? ""}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Certificate</span>
        <select
          name="certificate"
          defaultValue={initialFilters.certificate ?? ""}
          className="rounded border px-3 py-2"
        >
          <option value="">Any</option>
          <option value="true">Certificate courses</option>
          <option value="false">Non-certificate</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Sort</span>
        <select
          name="sort"
          defaultValue={initialFilters.sort ?? "updated_desc"}
          className="rounded border px-3 py-2"
        >
          <option value="updated_desc">Recently updated</option>
          <option value="title_asc">Title A-Z</option>
          <option value="title_desc">Title Z-A</option>
        </select>
      </label>
      <div className="flex items-end md:col-span-2 lg:col-span-3">
        <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">
          Apply filters
        </button>
      </div>
    </form>
  );
}
