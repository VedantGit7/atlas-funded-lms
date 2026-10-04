import { describe, expect, it, vi } from "vitest";
import {
  STEP_UP_MFA_ROUTE_RULES,
  matchesStepUpRouteRule,
} from "../../../backend/packages/authorization/src/step-up-mfa-policy";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));

// Capture the route config so the handler can be called directly.
vi.mock("@atlas/api", () => ({ createTenantRoute: (config: unknown) => config }));
vi.mock("@atlas/domain/reports/reports.service", () => ({
  getReportRun: async () => ({
    data: { id: "run-1", definitionKey: "learners", params: {} },
  }),
}));
vi.mock("@atlas/domain/reports/reports.repository", () => ({
  reportsRepository: {
    findDefinitionByKey: async () => ({
      dataset_key: "learners",
      params_json: {},
      param_schema_json: {},
      scope: "platform",
    }),
    findRunById: async () => ({ params_json: {} }),
  },
}));
vi.mock("@atlas/domain/reports/reports.datasets", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildReportDataset: async () => ({ columns: ["email", "score"], rows: mocks.rows }),
}));

import { GET as previewRoute } from "../../../backend/apps/api/src/app/api/v1/reports/runs/[runId]/preview/route";
import { REPORT_PREVIEW_ROW_LIMIT } from "../../../backend/apps/api/src/server/reports/reports.schemas";

/**
 * Report exports require step-up MFA (H4 follow-up). These pin the boundary:
 * producing, retrieving and redirecting exports are challenged; viewing a
 * report on screen is not, and the on-screen preview cannot stand in for the
 * file.
 */
describe("report export step-up rules", () => {
  it.each([
    ["POST", "/api/v1/reports/batches/export"],
    ["POST", "/api/v1/reports/batches/exports"],
    ["POST", "/api/v1/reports/custom-field/segments/[segmentId]/learners/export"],
    ["POST", "/api/v1/reports/payments/gateways/[gatewayKey]/export"],
    ["POST", "/api/v1/reports/bi-exports"],
    ["POST", "/api/v1/reports/exports/[runId]/retry"],
    ["POST", "/api/v1/reports/polls/exports/[runId]/retry"],
    ["POST", "/api/v1/reports/schedules"],
    ["PATCH", "/api/v1/reports/schedules/[id]"],
    ["PATCH", "/api/v1/reports/zoom-insights/exports/schedules/[scheduleId]"],
    ["POST", "/api/v1/reports/exports/schedules/[scheduleId]/run"],
    ["POST", "/api/v1/reports/exports/schedules/bulk"],
    ["POST", "/api/v1/reports/exports/destinations/[destinationId]/test"],
    ["GET", "/api/v1/reports/runs/[runId]/download/[format]"],
    ["GET", "/api/v1/reports/exports/[runId]"],
    ["GET", "/api/v1/reports/bi-exports/[id]"],
    ["GET", "/api/v1/exports/[id]"],
    ["GET", "/api/v1/sales/attribution/export"],
  ])("challenges %s %s", (method, route) => {
    expect(matchesStepUpRouteRule(route, method)).not.toBeNull();
  });

  it.each([
    ["POST", "/api/v1/reports/runs"],
    ["GET", "/api/v1/reports/runs/[runId]"],
    ["GET", "/api/v1/reports/runs/[runId]/preview"],
    ["GET", "/api/v1/reports/batches/exports"],
    ["GET", "/api/v1/reports/exports"],
    ["POST", "/api/v1/reports/exports/[runId]/cancel"],
    ["POST", "/api/v1/reports/exports/preview"],
    ["GET", "/api/v1/reports/batches"],
    ["GET", "/api/v1/locales/export"],
  ])("leaves %s %s to report permissions", (method, route) => {
    expect(matchesStepUpRouteRule(route, method)).toBeNull();
  });

  it("explains every rule", () => {
    for (const rule of STEP_UP_MFA_ROUTE_RULES) {
      expect(rule.reason.length).toBeGreaterThan(10);
      expect(rule.category).toBe("bulk-data");
    }
  });
});

describe("report run preview", () => {
  type Handler = (args: unknown) => Promise<{
    data: { preview: { rows: unknown[]; totalRowCount?: number } };
  }>;
  const handler = (previewRoute as unknown as { handler: Handler }).handler;
  const run = () =>
    handler({ tx: {}, ctx: { tenantId: "t", actorMembershipId: "m" }, params: { runId: "run-1" } });

  it("returns at most the on-screen limit and reports the full size", async () => {
    mocks.rows = Array.from({ length: REPORT_PREVIEW_ROW_LIMIT + 250 }, (_, index) => ({
      email: `learner-${String(index)}@example.test`,
      score: index,
    }));
    const { data } = await run();
    expect(data.preview.rows).toHaveLength(REPORT_PREVIEW_ROW_LIMIT);
    expect(data.preview.totalRowCount).toBe(REPORT_PREVIEW_ROW_LIMIT + 250);
  });

  it("returns small results whole, without a total", async () => {
    mocks.rows = [{ email: "a@example.test", score: 1 }];
    const { data } = await run();
    expect(data.preview.rows).toHaveLength(1);
    expect(data.preview.totalRowCount).toBeUndefined();
  });
});
