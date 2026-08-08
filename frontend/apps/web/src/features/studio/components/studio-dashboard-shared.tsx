export {
  cardClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  sectionDescClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

export { formatRelativeUpdatedAt } from "../../../app/admin/branding/_components/branding-admin-shared";

export type ContentStatusSummary = {
  published: number;
  draft: number;
  review: number;
  archived: number;
};

export function studioGreeting(displayName: string | null): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? `${salutation}, ${firstName}.` : `${salutation}.`;
}

export function summarizeContentStatus(
  courses: Array<{ status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED" }>,
): ContentStatusSummary {
  const summary: ContentStatusSummary = { published: 0, draft: 0, review: 0, archived: 0 };
  for (const course of courses) {
    if (course.status === "PUBLISHED") summary.published += 1;
    if (course.status === "DRAFT") summary.draft += 1;
    if (course.status === "REVIEW") summary.review += 1;
    if (course.status === "ARCHIVED") summary.archived += 1;
  }
  return summary;
}
