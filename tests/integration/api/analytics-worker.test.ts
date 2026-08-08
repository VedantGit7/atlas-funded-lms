import { describe, expect, it } from "vitest";
import { processAnalyticsOutboxBatch } from "../../../backend/apps/api/src/server/analytics/analytics-worker-router";
import { createAnalyticsOutboxConsumers } from "../../../backend/apps/api/src/events/outbox-consumers";

describe("analytics worker wiring", () => {
  it("exposes analytics outbox consumers for approved source events", () => {
    const consumers = createAnalyticsOutboxConsumers();
    expect(consumers["lesson.completed"]?.[0]?.destinationKey).toBe("analytics.projections");
    expect(consumers["assessment.submitted"]?.[0]?.destinationKey).toBe("analytics.projections");
    expect(consumers["challenge.purchased"]).toBeUndefined();
    expect(typeof processAnalyticsOutboxBatch).toBe("function");
  });
});
