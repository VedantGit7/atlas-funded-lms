import type { ReactNode } from "react";

type PermissionBoundaryProps = Readonly<{
  /** Server-projected permission result — never derived from hidden payloads. */
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}>;

export function PermissionBoundary({
  allowed,
  children,
  fallback = null,
}: PermissionBoundaryProps) {
  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
