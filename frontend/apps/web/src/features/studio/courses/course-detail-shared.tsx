import type { LucideIcon } from "lucide-react";
import { BarChart3, LayoutGrid, PenLine, Settings } from "lucide-react";
import { DEFAULT_CATEGORIES, type CategoryOption } from "./create-course-category-picker";

export const courseDetailCardClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]";

export const courseDetailMutedTextClassName = "text-sm text-[var(--admin-on-surface-variant)]";

export const courseDetailSectionTitleClassName =
  "text-lg font-semibold text-[var(--admin-on-surface)]";

export type CourseDetailTabId = "overview" | "dashboard" | "editor" | "settings";

export type CourseDetailTab = {
  id: CourseDetailTabId;
  label: string;
  href: (courseId: string) => string;
  icon: LucideIcon;
};

export const COURSE_DETAIL_TABS: CourseDetailTab[] = [
  {
    id: "overview",
    label: "Overview",
    href: (courseId) => `/studio/courses/${courseId}`,
    icon: LayoutGrid,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: (courseId) => `/studio/courses/${courseId}/dashboard`,
    icon: BarChart3,
  },
  {
    id: "editor",
    label: "Course editor",
    href: (courseId) => `/studio/courses/${courseId}/editor`,
    icon: PenLine,
  },
  {
    id: "settings",
    label: "Settings",
    href: (courseId) => `/studio/courses/${courseId}/settings`,
    icon: Settings,
  },
];

/** Routes that use the course id segment but not the tabbed course-detail shell. */
export function isStandaloneStudioCourseRoute(pathname: string, courseId: string): boolean {
  const base = `/studio/courses/${courseId}`;
  return pathname === `${base}/learners` || pathname.startsWith(`${base}/lessons/`);
}

export function resolveActiveCourseTab(pathname: string, courseId: string): CourseDetailTabId {
  if (pathname.startsWith(`/studio/courses/${courseId}/dashboard`)) return "dashboard";
  if (pathname.startsWith(`/studio/courses/${courseId}/editor`)) return "editor";
  if (pathname.startsWith(`/studio/courses/${courseId}/settings`)) return "settings";
  return "overview";
}

export function formatCourseCategoryLabel(
  categoryValue: string | null | undefined,
  categories: CategoryOption[] = DEFAULT_CATEGORIES,
): string | null {
  if (!categoryValue) return null;
  const match = categories.find((option) => option.value === categoryValue);
  if (match) return match.label;
  return categoryValue.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function readCourseCategory(tags?: Record<string, unknown>): string | null {
  const value = tags?.["category"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readInstructorMembershipIds(tags?: Record<string, unknown>): string[] {
  const raw = tags?.["instructorMembershipIds"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function formatSectionLessonSummary(moduleCount: number, lessonCount: number): string {
  const sectionLabel = moduleCount === 1 ? "section" : "sections";
  const lessonLabel = lessonCount === 1 ? "lesson" : "lessons";
  return `${moduleCount} ${sectionLabel} · ${lessonCount} ${lessonLabel}`;
}
