import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type LoadingRegionProps = Readonly<{
  label?: string;
  children?: ReactNode;
}>;

/** Suspense island wrapper with skeleton fallback (performance.md §3.1). */
export function LoadingRegion({ label = "Loading", children }: LoadingRegionProps) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3">
      {children ?? (
        <>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </>
      )}
    </div>
  );
}
