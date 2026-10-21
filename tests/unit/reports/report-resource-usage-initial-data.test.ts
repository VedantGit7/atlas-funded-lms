import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], fail: false }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.fail
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path } });
    },
  },
}));

const resourceUsage =
  await import("../../../frontend/apps/web/src/lib/server/report-resource-usage-initial-data");

beforeEach(() => {
  state.paths = [];
  state.fail = false;
});

const R = "/api/v1/reports/resource-usage";

/*
 * Each Resource usage panel and detail page skips its first browser load when
 * the server sent data, so the server must ask for exactly what that load
 * would have. These are the requests the pages made in the browser before
 * they were server-rendered; the dormant and inactive panels' first load uses
 * the default rules, before an operator's saved ones are read.
 */
describe("Resource usage initial data", () => {
  it("asks for what each panel's and detail page's first browser load would", async () => {
    await resourceUsage.loadResourceUsageHistoryData();
    await resourceUsage.loadResourceUsageStorageData();
    await resourceUsage.loadResourceUsageDormantData();
    await resourceUsage.loadResourceUsageInactiveData();
    await resourceUsage.loadResourceUsageDormantCourseData("course-1");
    await resourceUsage.loadResourceUsageMetricData("usage.storage_gb");
    expect(state.paths).toEqual([
      `${R}/history?page=1&limit=50&rangeMonths=24&sort=newest`,
      `${R}/storage?sort=size_desc&page=1&limit=12`,
      `${R}/dormant?page=1&limit=25&view=all&status=all&dormantDays=30&minLessons=1&includeUnpublished=true&includeArchived=false&enrolmentFilter=any&sort=storage_desc`,
      `${R}/inactive-learners?page=1&limit=25&view=all&activityStatus=any&inactiveDays=90&enrolmentFilter=any&paidFilter=any&includeInvitedNeverSignedIn=true&excludeActivePaidEnrolment=false&sort=inactive_desc`,
      `${R}/dormant/course-1?dormantDays=30`,
      `${R}/metrics/usage.storage_gb`,
    ]);
  });

  it("keeps ids inside their own path segments", async () => {
    await resourceUsage.loadResourceUsageDormantCourseData("a/b?c");
    await resourceUsage.loadResourceUsageMetricData("x/y");
    expect(state.paths).toEqual([`${R}/dormant/a%2Fb%3Fc?dormantDays=30`, `${R}/metrics/x%2Fy`]);
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.fail = true;
    await expect(resourceUsage.loadResourceUsageHistoryData()).resolves.toBeNull();
    await expect(resourceUsage.loadResourceUsageStorageData()).resolves.toBeNull();
    await expect(resourceUsage.loadResourceUsageDormantData()).resolves.toBeNull();
    await expect(resourceUsage.loadResourceUsageInactiveData()).resolves.toBeNull();
    await expect(resourceUsage.loadResourceUsageDormantCourseData("course-1")).resolves.toBeNull();
    await expect(resourceUsage.loadResourceUsageMetricData("usage.storage_gb")).resolves.toBeNull();
  });
});
