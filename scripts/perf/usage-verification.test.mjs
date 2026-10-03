import test from "node:test";
import assert from "node:assert/strict";
import { reconcileUsage } from "./usage-verification.mjs";

const snapshot = (requests) => ({
  tenantId: "fixture",
  capturedAt: "2026-09-26T00:00:00Z",
  journal: { requests, events: requests, pending: requests, emails: 0 },
  rollupRequests: 0,
});
const report = {
  setupByOperation: { enrollment: { attempts: 2, errors: 0 } },
  phases: [
    {
      cancelledRequests: 0,
      byOperation: Object.fromEntries(
        ["course", "lesson", "progress-save", "progress-read"].map((name) => [
          name,
          { attempts: 10, errors: 0 },
        ]),
      ),
    },
  ],
};
test("reconciles complete metered operations against durable rows, excluding identity and authentication", () => {
  const result = reconcileUsage(snapshot(10), snapshot(52), report);
  assert.equal(result.minimumExpectedRequests, 42);
  assert.equal(result.durableRequestDelta, 42);
  assert.equal(result.withinExpectedBounds, true);
  assert.equal(result.exact, true);
});
test("fails a missing durable request and does not hide unexplained excess", () => {
  assert.equal(reconcileUsage(snapshot(10), snapshot(51), report).withinExpectedBounds, false);
  assert.equal(reconcileUsage(snapshot(10), snapshot(53), report).withinExpectedBounds, false);
});
test("discloses uncertainty for cancelled HTTP requests without claiming exact reconciliation", () => {
  const uncertain = structuredClone(report);
  uncertain.phases[0].cancelledRequests = 3;
  const result = reconcileUsage(snapshot(10), snapshot(53), uncertain);
  assert.equal(result.maximumExpectedRequests, 45);
  assert.equal(result.withinExpectedBounds, true);
  assert.equal(result.exact, false);
});
test("refuses incompatible snapshots and incomplete operation evidence", () => {
  assert.throws(() => reconcileUsage(snapshot(10), { ...snapshot(52), tenantId: "other" }, report));
  assert.throws(() => reconcileUsage(snapshot(10), snapshot(52), { phases: [] }));
  assert.throws(() =>
    reconcileUsage(snapshot(10), snapshot(52), { ...report, phases: [{ byOperation: {} }] }),
  );
});
