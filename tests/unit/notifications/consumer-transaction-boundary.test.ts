import { expect, it, vi } from "vitest";
import { processAnalyticsOutboxBatch } from "../../../backend/apps/api/src/server/analytics/analytics-worker-router";

const state = vi.hoisted(() => ({ active: false, transactions: 0 }));
vi.mock("@atlas/db", () => ({
  withTenantTx: async (_scope: unknown, fn: (tx: object) => Promise<unknown>) => {
    state.active = true;
    try {
      state.transactions++;
      return await fn({});
    } finally {
      state.active = false;
    }
  },
}));
vi.mock("@atlas/observability", () => ({
  runWorkerOutboxBatch: ({ execute }: { execute: () => unknown }) => execute(),
}));
vi.mock("../../../backend/apps/api/src/events/outbox-consumers", () => ({
  createAnalyticsOutboxConsumers: () => ({}),
}));
vi.mock("@atlas/events/services/outbox-worker.service", () => ({
  processOutboxBatch: async (db: { transaction: (fn: () => Promise<void>) => Promise<void> }) => {
    expect(state.active).toBe(false);
    await db.transaction(async () => {
      expect(state.active).toBe(true);
    });
    expect(state.active).toBe(false);
    await db.transaction(async () => {
      expect(state.active).toBe(true);
    });
    return { processed: 1, delivered: 1, failed: 0, skipped: 0 };
  },
}));

it("gives the worker independent committed transactions instead of holding a transaction across handlers", async () => {
  expect(
    await processAnalyticsOutboxBatch({ tenantId: "tenant", requestId: "request" }),
  ).toMatchObject({ delivered: 1 });
  expect(state.transactions).toBe(2);
  expect(state.active).toBe(false);
});
