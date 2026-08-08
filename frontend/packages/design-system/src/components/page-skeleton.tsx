import { Skeleton } from "./skeleton";
import { cn } from "../lib/cn";

export type PageSkeletonProps = {
  title?: string;
  rows?: number;
  className?: string;
};

export function PageSkeleton({ title, rows = 4, className }: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-4 p-6", className)}
      aria-busy="true"
      aria-label={title ?? "Loading"}
    >
      <Skeleton className="h-8 w-48 max-w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
