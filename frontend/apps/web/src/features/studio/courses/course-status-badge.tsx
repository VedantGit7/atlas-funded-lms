type CourseStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draft",
  REVIEW: "In review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight";

  if (status === "PUBLISHED") {
    return (
      <span
        className={`${base} bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" aria-hidden="true" />
        {STATUS_LABELS[status]}
      </span>
    );
  }

  if (status === "REVIEW") {
    return (
      <span
        className={`${base} bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-warning)]" aria-hidden="true" />
        {STATUS_LABELS[status]}
      </span>
    );
  }

  if (status === "ARCHIVED") {
    return (
      <span
        className={`${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-outline)]" aria-hidden="true" />
        {STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <span
      className={`${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
