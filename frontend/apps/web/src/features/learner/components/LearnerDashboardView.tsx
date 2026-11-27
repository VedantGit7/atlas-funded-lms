import { LearnerDashboard, type LearnerDashboardData } from "./dashboard/LearnerDashboard";

export type { LearnerDashboardData };

/** The learner home (QA remediation S3.3); the data is read on the server by the home page. */
export function LearnerDashboardView({ data }: { data: LearnerDashboardData }) {
  return <LearnerDashboard data={data} />;
}
