import "server-only";
import {
  RESOURCE_USAGE_DORMANCY_DEFAULTS,
  RESOURCE_USAGE_DORMANT_DEFAULTS,
  RESOURCE_USAGE_HISTORY_DEFAULTS,
  RESOURCE_USAGE_INACTIVE_DEFAULTS,
  RESOURCE_USAGE_INACTIVITY_DEFAULTS,
  RESOURCE_USAGE_STORAGE_DEFAULTS,
  resourceUsageDormantCoursePath,
  resourceUsageDormantPath,
  resourceUsageHistoryPath,
  resourceUsageInactivePath,
  resourceUsageMetricDetailPath,
  resourceUsageStoragePath,
  type ResourceUsageDormantCourseDetail,
  type ResourceUsageDormantResponse,
  type ResourceUsageHistoryResponse,
  type ResourceUsageInactiveResponse,
  type ResourceUsageMetricDetail,
  type ResourceUsageStorageResponse,
} from "../../features/admin/reports/admin-resource-usage-roster-api";
import { loadReportInitialData } from "./report-initial-data";

/*
 * The first data each Resource usage panel and detail page shows, loaded on
 * the server so the page arrives filled in. Every path is the one the page's
 * own first browser load would request, so the page can skip that load; each
 * resolves null on failure and the page then loads in the browser as before.
 * The dormant and inactive panels start on the default rules: an operator's
 * saved rules live in their browser, which reloads the panel with them.
 */

export function loadResourceUsageHistoryData() {
  return loadReportInitialData<ResourceUsageHistoryResponse>(
    resourceUsageHistoryPath(RESOURCE_USAGE_HISTORY_DEFAULTS),
  );
}

export function loadResourceUsageStorageData() {
  return loadReportInitialData<ResourceUsageStorageResponse>(
    resourceUsageStoragePath(RESOURCE_USAGE_STORAGE_DEFAULTS),
  );
}

export function loadResourceUsageDormantData() {
  return loadReportInitialData<ResourceUsageDormantResponse>(
    resourceUsageDormantPath({
      ...RESOURCE_USAGE_DORMANT_DEFAULTS,
      ...RESOURCE_USAGE_DORMANCY_DEFAULTS,
    }),
  );
}

export function loadResourceUsageInactiveData() {
  return loadReportInitialData<ResourceUsageInactiveResponse>(
    resourceUsageInactivePath({
      ...RESOURCE_USAGE_INACTIVE_DEFAULTS,
      ...RESOURCE_USAGE_INACTIVITY_DEFAULTS,
    }),
  );
}

export function loadResourceUsageDormantCourseData(courseId: string) {
  return loadReportInitialData<ResourceUsageDormantCourseDetail>(
    resourceUsageDormantCoursePath(courseId),
  );
}

export function loadResourceUsageMetricData(metricKey: string) {
  return loadReportInitialData<ResourceUsageMetricDetail>(resourceUsageMetricDetailPath(metricKey));
}
