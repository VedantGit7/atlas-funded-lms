type EnrollmentStatusBadgeProps = {
  status: "enrolled" | "not_enrolled";
};

export function EnrollmentStatusBadge({ status }: EnrollmentStatusBadgeProps) {
  if (status === "enrolled") {
    return (
      <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
        Enrolled
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium opacity-70">
      Not enrolled
    </span>
  );
}
