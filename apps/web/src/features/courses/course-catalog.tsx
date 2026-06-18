import type { CourseCardData } from "./course-card";
import { CourseCard } from "./course-card";
import { CourseFilters, type CourseFilterValues } from "./course-filters";

type CourseCatalogProps = {
  initialItems: CourseCardData[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
  initialFilters: CourseFilterValues;
};

export function CourseCatalog({ initialItems, pageInfo, initialFilters }: CourseCatalogProps) {
  if (initialItems.length === 0) {
    return (
      <div className="space-y-6">
        <CourseFilters initialFilters={initialFilters} />
        <p role="status">No published courses match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CourseFilters initialFilters={initialFilters} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialItems.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
      {pageInfo.hasNextPage && pageInfo.nextCursor ? (
        <p className="text-sm opacity-70">
          More courses are available. Refine filters to narrow results.
        </p>
      ) : null}
    </div>
  );
}
