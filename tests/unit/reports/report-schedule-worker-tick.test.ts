import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasDue, mockTick, mockActorRows } = vi.hoisted(() => ({
  mockHasDue: vi.fn(),
  mockTick: vi.fn(),
  mockActorRows: vi.fn(),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ $queryRaw: (...args: unknown[]) => mockActorRows(...args) }),
}));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: vi.fn() }));
vi.mock("@atlas/domain/reports/reports.repository", () => ({
  reportsRepository: { hasDueSchedules: (...args: unknown[]) => mockHasDue(...args) },
}));
vi.mock("@atlas/domain/reports/reports.service", () => ({
  tickReportSchedules: (...args: unknown[]) => mockTick(...args),
}));
vi.mock("../../../backend/apps/api/src/server/reports/reports-worker-router", () => ({
  processReportsOutboxBatch: vi.fn(),
}));

import {
  REPORT_SCHEDULE_TICK_INTERVAL_MS,
  resetReportScheduleTickClock,
  tickDueReportSchedulesForTenant,
} from "../../../backend/apps/api/src/server/reports/reports-tick.service";

const tenantA = "018f0000-0000-7000-8000-00000000000a";
const tenantB = "018f0000-0000-7000-8000-00000000000b";
const t0 = Date.parse("2026-10-01T10:00:00.000Z");

describe("report schedule tick in the outbox worker", () => {
  beforeEach(() => {
    resetReportScheduleTickClock();
    mockHasDue.mockReset().mockResolvedValue(true);
    mockActorRows.mockReset().mockResolvedValue([{ id: "member-1" }]);
    mockTick.mockReset().mockResolvedValue({
      data: { tenantsProcessed: 1, schedulesClaimed: 2, runsEnqueued: 2 },
    });
  });

  it("enqueues due schedules and reports how many runs it created", async () => {
    await expect(
      tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 }),
    ).resolves.toBe(2);
    expect(mockTick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: tenantA, actorMembershipId: "member-1" }),
    );
  });

  it("checks each tenant at most once per interval, though the worker sweeps every few seconds", async () => {
    await tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 });
    await tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 + 5_000 });
    await tickDueReportSchedulesForTenant({
      tenantId: tenantA,
      requestId: "r",
      nowMs: t0 + REPORT_SCHEDULE_TICK_INTERVAL_MS - 1,
    });
    expect(mockHasDue).toHaveBeenCalledTimes(1);

    await tickDueReportSchedulesForTenant({
      tenantId: tenantA,
      requestId: "r",
      nowMs: t0 + REPORT_SCHEDULE_TICK_INTERVAL_MS,
    });
    expect(mockHasDue).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate clock per tenant", async () => {
    await tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 });
    await tickDueReportSchedulesForTenant({ tenantId: tenantB, requestId: "r", nowMs: t0 + 1 });
    expect(mockHasDue).toHaveBeenCalledTimes(2);
  });

  it("skips the full tick, and its definition upserts, when nothing is due", async () => {
    mockHasDue.mockResolvedValue(false);
    await expect(
      tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 }),
    ).resolves.toBe(0);
    expect(mockTick).not.toHaveBeenCalled();
  });

  it("does nothing for a tenant without an active member to attribute the batch to", async () => {
    mockActorRows.mockResolvedValue([]);
    await expect(
      tickDueReportSchedulesForTenant({ tenantId: tenantA, requestId: "r", nowMs: t0 }),
    ).resolves.toBe(0);
    expect(mockTick).not.toHaveBeenCalled();
  });
});
