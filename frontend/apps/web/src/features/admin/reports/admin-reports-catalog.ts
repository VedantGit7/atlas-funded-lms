export const ADMIN_REPORT_SECTIONS = [
  { slug: "enrollments", label: "Enrollments", title: "Enrollments" },
  { slug: "active-devices", label: "Active Devices", title: "Active Devices" },
  { slug: "payments", label: "Payments", title: "Payments" },
  { slug: "progress-score", label: "Progress & Score", title: "Progress & Score" },
  { slug: "batches", label: "Batches", title: "Batches" },
  { slug: "polls", label: "Polls", title: "Polls" },
  { slug: "sales-marketing", label: "Sales & Marketing", title: "Sales & Marketing" },
  { slug: "custom-field", label: "Custom Field", title: "Custom Field" },
  { slug: "zoom-insights", label: "Zoom Insights", title: "Zoom Insights" },
  {
    slug: "live-class-attendance",
    label: "Live Class Attendance",
    title: "Live Class Attendance",
  },
  { slug: "super-live-insights", label: "Super Live Insights", title: "Super Live Insights" },
  { slug: "resource-usage", label: "Resource Usage", title: "Resource Usage" },
  { slug: "exports", label: "Exports", title: "Exports" },
] as const;

export type AdminReportSlug = (typeof ADMIN_REPORT_SECTIONS)[number]["slug"];

export function getAdminReportSection(slug: string) {
  return ADMIN_REPORT_SECTIONS.find((section) => section.slug === slug) ?? null;
}

export const ADMIN_REPORTS_HREF = "/admin/reports";
export const ADMIN_REPORTS_DEFAULT_HREF = `${ADMIN_REPORTS_HREF}/enrollments`;

export function adminReportHref(slug: AdminReportSlug): string {
  return `${ADMIN_REPORTS_HREF}/${slug}`;
}
