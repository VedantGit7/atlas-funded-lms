"use client";

import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import type { CustomFieldLearnerDetailData } from "./admin-custom-field-roster-api";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";
import { AdminCustomFieldLearnerValuesView } from "./AdminCustomFieldLearnerValuesView";

export function AdminCustomFieldLearnerPage({
  membershipId,
  initialDetail,
}: {
  membershipId: string;
  /** The learner's values, loaded by the server; the first browser load is skipped when present. */
  initialDetail?: ReportInitialData<CustomFieldLearnerDetailData> | null;
}) {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <CustomFieldReportTabs active="learners" />
      <AdminCustomFieldLearnerValuesView
        membershipId={membershipId}
        variant="page"
        initialDetail={initialDetail ?? null}
      />
    </div>
  );
}
