"use client";

type SearchTypeFiltersProps = {
  activeType?: string;
  query: string;
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "course", label: "Courses" },
  { value: "post", label: "Posts" },
  { value: "certificate", label: "Certificates" },
] as const;

export function SearchTypeFilters({ activeType, query }: SearchTypeFiltersProps) {
  if (query.length < 2) {
    return null;
  }

  return (
    <nav aria-label="Search type filters" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const params = new URLSearchParams();
        params.set("q", query);
        if (filter.value) {
          params.set("type", filter.value);
        }

        const isActive = (activeType ?? "") === filter.value;

        return (
          <a
            key={filter.label}
            href={`/search?${params.toString()}`}
            className={`rounded border px-3 py-1 text-sm ${isActive ? "font-semibold" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {filter.label}
          </a>
        );
      })}
    </nav>
  );
}
