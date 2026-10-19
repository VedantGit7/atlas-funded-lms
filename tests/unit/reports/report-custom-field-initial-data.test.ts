import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paths: [] as string[], failing: [] as string[] }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({
  serverApi: {
    get: (path: string) => {
      state.paths.push(path);
      return state.failing.some((part) => path.includes(part))
        ? Promise.reject(new Error("The report is unavailable."))
        : Promise.resolve({ data: { path, items: [] } });
    },
  },
}));

const customField =
  await import("../../../frontend/apps/web/src/lib/server/report-custom-field-initial-data");

beforeEach(() => {
  state.paths = [];
  state.failing = [];
});

const C = "/api/v1/reports/custom-field";

/*
 * Each Custom field page skips its first browser load when the server sent
 * data, so the server must ask for exactly what that load would have. These
 * are the requests the pages made in the browser before they were
 * server-rendered.
 */
describe("Custom field initial data", () => {
  it("asks for what each page's first browser load would", async () => {
    await customField.loadCustomFieldCohortsData();
    await customField.loadCustomFieldCatalogueData();
    await customField.loadCustomFieldDetailData("experience");
    await customField.loadCustomFieldLearnerData("mem-1");
    await customField.loadCustomFieldSegmentsData();
    await customField.loadCustomFieldSegmentDetailData("seg-1");
    await customField.loadSegmentBuilderData();
    await customField.loadSegmentBuilderData("seg-1");
    expect(state.paths).toEqual([
      `${C}/cohorts/groups?page=1&limit=10`,
      `${C}/cohorts/messages?page=1&limit=10`,
      `${C}/catalogue?status=ALL&coverage=any&sortBy=coverage_asc`,
      `${C}/catalogue/experience?page=1&limit=10`,
      `${C}/learners/mem-1`,
      `${C}/segments`,
      `${C}/segments/seg-1/view`,
      `${C}/segments/seg-1/learners?page=1&limit=25`,
      `${C}/catalogue?status=ACTIVE&sortBy=label_asc`,
      `${C}/catalogue?status=ACTIVE&sortBy=label_asc`,
      `${C}/segments/seg-1`,
    ]);
  });

  it("keeps ids inside their own path segments", async () => {
    await customField.loadCustomFieldDetailData("a/b?c");
    await customField.loadCustomFieldLearnerData("m/1");
    await customField.loadCustomFieldSegmentDetailData("s/1");
    expect(state.paths).toEqual([
      `${C}/catalogue/a%2Fb%3Fc?page=1&limit=10`,
      `${C}/learners/m%2F1`,
      `${C}/segments/s%2F1/view`,
      `${C}/segments/s%2F1/learners?page=1&limit=25`,
    ]);
  });

  it("asks for no segment learners when the segment fails to load", async () => {
    state.failing = ["/view"];
    await expect(customField.loadCustomFieldSegmentDetailData("seg-1")).resolves.toEqual({
      view: null,
      learners: null,
    });
    expect(state.paths).toEqual([`${C}/segments/seg-1/view`]);
  });

  it("gives the builder its catalogue and segment together, or nothing", async () => {
    await expect(customField.loadSegmentBuilderData()).resolves.toMatchObject({
      data: { segment: null },
    });
    state.failing = ["/segments/seg-1"];
    await expect(customField.loadSegmentBuilderData("seg-1")).resolves.toBeNull();
    state.failing = ["/catalogue"];
    await expect(customField.loadSegmentBuilderData()).resolves.toBeNull();
  });

  it("resolves null when a load fails, so the page loads in the browser instead", async () => {
    state.failing = ["/"];
    await expect(customField.loadCustomFieldCohortsData()).resolves.toBeNull();
    await expect(customField.loadCustomFieldCatalogueData()).resolves.toBeNull();
    await expect(customField.loadCustomFieldSegmentsData()).resolves.toBeNull();
  });
});
