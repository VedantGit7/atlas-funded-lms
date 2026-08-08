/**
 * Shared catalog filter shape. The former `CourseFilters` component was
 * superseded by the redesigned catalog's inline filter bar; this module remains
 * the single source of truth for the filter values carried through the URL.
 */
export type CourseFilterValues = {
  q?: string;
  stage?: string;
  dimension?: string;
  persona?: string;
  certificate?: string;
  sort?: string;
};
