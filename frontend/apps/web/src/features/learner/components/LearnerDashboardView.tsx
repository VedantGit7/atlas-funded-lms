import type { ReactNode } from "react";
import { LearnerDashboard, type LearnerDashboardData } from "./dashboard/LearnerDashboard";

export type { LearnerDashboardData };

/**
 * `personalizedSection` is a server-rendered slot (streamed under Suspense by
 * the home page) so the personalized next-best-action can load independently of
 * the dashboard shell.
 */
export function LearnerDashboardView({
  data,
  personalizedSection,
}: {
  data: LearnerDashboardData;
  personalizedSection?: ReactNode;
}) {
  return <LearnerDashboard data={data} personalizedSection={personalizedSection} />;
}
