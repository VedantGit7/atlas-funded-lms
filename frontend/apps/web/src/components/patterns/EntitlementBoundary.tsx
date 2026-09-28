import type { ReactNode } from "react";
import { EmptyState } from "@atlas/design-system/components/empty-state";

type EntitlementBoundaryProps = Readonly<{
  /** Server-projected entitlement result — never derived from plan names client-side. */
  entitled: boolean;
  children: ReactNode;
  title?: string;
  description?: string;
  fallback?: ReactNode;
}>;

export function EntitlementBoundary({
  entitled,
  children,
  title = "Feature unavailable",
  description = "This feature is not included in your current plan.",
  fallback,
}: EntitlementBoundaryProps) {
  if (entitled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="p-6" role="status">
      <EmptyState title={title} description={description} />
    </div>
  );
}
