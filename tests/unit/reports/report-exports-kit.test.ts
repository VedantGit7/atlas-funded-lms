import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportsService = vi.hoisted(() => ({
  createReportRun: vi.fn(),
  deleteReportSchedule: vi.fn(),
  getReportRun: vi.fn(),
  listReportRuns: vi.fn(),
  listReportSchedules: vi.fn(),
  updateReportSchedule: vi.fn(),
}));

vi.mock("../../../backend/packages/domain/src/reports/reports.service", () => reportsService);

import {
  cadenceLabel,
  createExportOperations,
  cronFromCadence,
  describeExportRun,
  describeExportSchedule,
  requesterLabel,
  type ExportRun,
  type ExportSchedule,
  type ExportViewSpec,
} from "@atlas/domain/reports/report-exports.kit";

const NOW = new Date("2026-10-09T12:00:00.000Z");
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tx = {} as never;
const ctx = { tenantId: "t", actorMembershipId: ACTOR, requestId: "r" } as never;
const passThrough = { parse: (value: unknown) => value };

type Dataset = "orders" | "refunds";

const view: ExportViewSpec<Dataset> = {
  datasetParams: ["dataset", "reportTab"],
  normalizeDataset: (value) => (value === "refunds" ? "refunds" : "orders"),
  datasetLabel: (dataset) => (dataset === "refunds" ? "Refunds" : "Orders"),
  fileNameFor: (dataset, createdAt, format) => `${dataset}_${createdAt.slice(0, 10)}.${format}`,
  scopeLabel: () => "All time",
  errorMessageFor: (code) => (code ? `failed: ${code}` : null),
  requestedBy: true,
  columns: true,
  historyExtras: (params) => ({ note: params["note"] ?? null }),
  defaultScheduleName: "Sample export",
  cadenceWording: "comma",
  scheduleDataset: true,
  webhookLabel: "webhook",
};

function run(overrides: Partial<ExportRun> = {}): ExportRun {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    format: "csv",
    params: { reportTab: "refunds", columns: ["id", 3, "amount"], note: "n" },
    rowCount: 2000,
    status: "SUCCEEDED",
    createdAt: "2026-10-01T10:00:00.000Z",
    completedAt: "2026-10-01T10:00:05.000Z",
    expiresAt: "2026-10-10T10:00:00.000Z",
    errorCode: null,
    requestedByMembershipId: ACTOR,
    scheduleId: null,
    ...overrides,
  };
}

function schedule(overrides: Partial<ExportSchedule> = {}): ExportSchedule {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    definitionKey: "sample",
    name: null,
    definitionTitle: "",
    cronExpression: "30 6 1 * *",
    timezone: "UTC",
    formats: ["pdf"],
    isActive: true,
    nextRunAt: "2026-10-12T12:00:00.000Z",
    params: { dataset: "orders" },
    delivery: { emails: ["a@example.test", 4], webhookUrl: "https://hooks.example.test" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("report export wording", () => {
  it("builds cron from a cadence, with the weekly day configurable", () => {
    expect(cronFromCadence("daily", "07:30")).toBe("30 7 * * *");
    expect(cronFromCadence("weekly", "07:30")).toBe("30 7 * * 1");
    expect(cronFromCadence("weekly", "07:30", 5)).toBe("30 7 * * 5");
    expect(cronFromCadence("monthly", "99:99")).toBe("59 23 1 * *");
  });

  it("keeps each report's cadence wording", () => {
    expect(cadenceLabel("0 6 * * 1", "UTC", "comma")).toBe("Every Monday, 06:00 UTC");
    expect(cadenceLabel("0 6 1 * *", "UTC", "comma")).toBe("Monthly on day 1, 06:00 UTC");
    expect(cadenceLabel("0 6 * * 1", "UTC", "at")).toBe("Every Monday at 06:00 UTC");
    expect(cadenceLabel("0 6 1 * *", "UTC", "at")).toBe("1st of every month at 06:00 UTC");
    expect(cadenceLabel("0 6 * * 5", "UTC", "friday-weekly")).toBe("Every Friday, 06:00 UTC");
    expect(cadenceLabel("0 6 * * 2", "UTC", "friday-weekly")).toBe("Weekly (dow 2), 06:00 UTC");
    expect(cadenceLabel("0 6 1 * *", "UTC", "ordinal-monthly")).toBe(
      "On the 1 of each month, 06:00 UTC",
    );
    expect(cadenceLabel("0 6 * * *", "UTC", "at")).toBe("Daily at 06:00 UTC");
  });

  it("names who asked for an export", () => {
    expect(requesterLabel(ACTOR, ACTOR, null)).toBe("You");
    expect(requesterLabel("someone", ACTOR, null)).toBe("Admin");
    expect(requesterLabel(ACTOR, ACTOR, "schedule")).toBe("System");
    expect(requesterLabel(null, ACTOR, null)).toBe("System");
  });
});

describe("report export views", () => {
  it("describes a run from the first dataset parameter that is set", () => {
    const item = describeExportRun(view, run(), ACTOR);
    expect(item).toMatchObject({
      dataset: "refunds",
      datasetLabel: "Refunds",
      fileName: "refunds_2026-10-01.csv",
      sizeLabel: "~125KB",
      requestedByLabel: "You",
      expired: false,
      downloadAvailable: true,
      columns: ["id", "amount"],
      note: "n",
    });
  });

  it("treats a run past its expiry as expired, and prefers a stored error message", () => {
    expect(
      describeExportRun(view, run({ expiresAt: "2026-10-01T00:00:00.000Z" }), ACTOR),
    ).toMatchObject({
      expired: true,
      downloadAvailable: false,
    });
    const failed = run({ status: "FAILED", errorCode: "X", errorMessage: "  " });
    expect(describeExportRun(view, failed, ACTOR).errorMessage).toBe("failed: X");
    expect(describeExportRun(view, { ...failed, errorMessage: "Stored" }, ACTOR).errorMessage).toBe(
      "Stored",
    );
  });

  it("leaves out optional fields a report does not show", () => {
    const item = describeExportRun(
      { ...view, requestedBy: false, columns: false, historyExtras: undefined },
      run(),
      ACTOR,
    );
    expect(item).not.toHaveProperty("requestedByLabel");
    expect(item).not.toHaveProperty("columns");
    expect(item).not.toHaveProperty("note");
  });

  it("describes a schedule with its default name, recipients and webhook", () => {
    expect(describeExportSchedule(view, schedule())).toMatchObject({
      name: "Sample export",
      dataset: "orders",
      cadenceLabel: "Monthly on day 1, 06:30 UTC",
      nextRunLabel: "Next run in 3 days",
      recipients: ["a@example.test"],
      webhookLabel: "webhook",
    });
    const plain = describeExportSchedule(
      { ...view, scheduleDataset: false, webhookLabel: null },
      schedule(),
    );
    expect(plain).not.toHaveProperty("dataset");
    expect(plain).not.toHaveProperty("webhookLabel");
  });
});

describe("report export operations", () => {
  const operations = createExportOperations({
    definitionKey: "sample",
    describeRun: (item, actor) => ({ id: item.id, format: item.format, actor }),
    describeSchedule: (item) => ({ id: item.id }),
    retryProcessInline: false,
    schemas: {
      runDetail: passThrough,
      retry: passThrough,
      updateScheduleBody: { parse: (value: unknown) => value as Record<string, unknown> },
      updateSchedule: passThrough,
      deleteSchedule: passThrough,
    },
  });

  it("refuses another report's runs and schedules", async () => {
    reportsService.getReportRun.mockResolvedValue({ data: { ...run(), definitionKey: "other" } });
    await expect(operations.getRun(tx, ctx, "id")).rejects.toMatchObject({ status: 404 });
    await expect(operations.retry(tx, ctx, "id")).rejects.toMatchObject({ status: 404 });
    reportsService.listReportSchedules.mockResolvedValue({
      data: { items: [schedule({ definitionKey: "other" })] },
    });
    await expect(
      operations.updateSchedule(tx, ctx, schedule().id, { isActive: false }),
    ).rejects.toMatchObject({ message: "Schedule was not found." });
    await expect(operations.deleteSchedule(tx, ctx, schedule().id)).rejects.toMatchObject({
      status: 404,
    });
    expect(reportsService.updateReportSchedule).not.toHaveBeenCalled();
    expect(reportsService.deleteReportSchedule).not.toHaveBeenCalled();
  });

  it("retries a PDF export as CSV unless a format is asked for", async () => {
    reportsService.getReportRun.mockResolvedValue({
      data: { ...run({ format: "pdf" }), definitionKey: "sample" },
    });
    reportsService.createReportRun.mockResolvedValue({ data: run({ id: "new" }) });
    await operations.retry(tx, ctx, "id");
    expect(reportsService.createReportRun).toHaveBeenLastCalledWith(
      tx,
      ctx,
      expect.objectContaining({ definitionKey: "sample", format: "csv" }),
      { processInline: false },
    );
    await operations.retry(tx, ctx, "id", { format: "xlsx" });
    expect(reportsService.createReportRun).toHaveBeenLastCalledWith(
      tx,
      ctx,
      expect.objectContaining({ format: "xlsx" }),
      { processInline: false },
    );
  });

  it("runs a schedule now, inline, recording which schedule triggered it", async () => {
    reportsService.listReportSchedules.mockResolvedValue({ data: { items: [schedule()] } });
    reportsService.createReportRun.mockResolvedValue({ data: run({ id: "now" }) });
    const result = await operations.runScheduleNow(tx, ctx, schedule().id, passThrough);
    expect(reportsService.createReportRun).toHaveBeenCalledWith(
      tx,
      ctx,
      {
        definitionKey: "sample",
        format: "csv",
        params: { dataset: "orders", triggeredFromScheduleId: schedule().id },
      },
      { processInline: true },
    );
    expect(result).toEqual({
      data: { run: { id: "now", format: "csv", actor: ACTOR }, schedule: { id: schedule().id } },
    });
  });
});
