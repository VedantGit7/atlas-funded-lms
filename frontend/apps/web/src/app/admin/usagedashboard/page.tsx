import type { UsageSummaryResponse } from "@atlas/domain-config/schemas/usage";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminUsageDashboard } from "../../../features/admin/usage/AdminUsageDashboard";
import type { UsageSummary } from "../../../features/admin/usage/usage-dashboard-utils";
import { ServerApiError, serverApi } from "../../../lib/server-api";

const EMPTY_SUMMARY: UsageSummary = {
  planName: null,
  planStartedAt: null,
  nextBillingAt: null,
  currentMau: 0,
  totalLearners: 0,
  totalVideoHours: 0,
  totalStorageGb: 0,
  limits: { storageGb: null, mau: null, bandwidthGb: null, videoHours: null },
  current: {
    bandwidthGb: 0,
    testSubmits: 0,
    drmTokens: 0,
    messageSends: 0,
    emailValidations: 0,
    totalLearners: 0,
    contentStorageGb: 0,
    products: 0,
    videoTranscodingHours: 0,
    questions: 0,
  },
  mau: { monthly: [], daily: [], comparison: { current: 0, m1: null, m3: null, m6: null, m9: null } },
  history: [],
};

function toSummary(response: UsageSummaryResponse): UsageSummary {
  const { plan, kpis, current, mau, history, limits } = response.data;
  return {
    planName: plan.name,
    planStartedAt: plan.startedAt,
    nextBillingAt: plan.nextBillingAt,
    currentMau: kpis.averageMau,
    totalLearners: kpis.totalLearners,
    totalVideoHours: kpis.totalVideoHours,
    totalStorageGb: kpis.totalStorageGb,
    limits,
    current,
    mau,
    history,
  };
}

export default async function AdminUsageDashboardRoute() {
  try {
    const response = await serverApi.get<UsageSummaryResponse>("/api/v1/usage/summary");

    return (
      <AdminPageGate screenId="T28" state="ready" title="Usage Insights">
        <AdminUsageDashboard summary={toSummary(response)} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T28"
          state="denied"
          title="Usage Insights"
          deniedMessage="You do not have permission to view usage insights."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate screenId="T28" state="ready" title="Usage Insights">
          <AdminUsageDashboard summary={EMPTY_SUMMARY} />
        </AdminPageGate>
      );
    }

    throw error;
  }
}
