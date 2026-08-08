"use client";

import { CustomFieldReportTabs } from "./CustomFieldReportTabs";
import { AdminCustomFieldLearnerValuesView } from "./AdminCustomFieldLearnerValuesView";

export function AdminCustomFieldLearnerPage({ membershipId }: { membershipId: string }) {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <CustomFieldReportTabs active="learners" />
      <AdminCustomFieldLearnerValuesView membershipId={membershipId} variant="page" />
    </div>
  );
}
