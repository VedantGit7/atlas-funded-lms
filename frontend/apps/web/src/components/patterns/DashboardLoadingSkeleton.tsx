import { BrandLoadingScreen } from "@/components/patterns/BrandLoadingScreen";

type DashboardLoadingSkeletonProps = Readonly<{
  title?: string;
}>;

/**
 * Dashboard / learner home route loading state. Delegates to the site-wide
 * branded loading screen for a consistent waiting experience.
 */
export function DashboardLoadingSkeleton({ title = "Loading dashboard" }: DashboardLoadingSkeletonProps) {
  return <BrandLoadingScreen label={title} />;
}
