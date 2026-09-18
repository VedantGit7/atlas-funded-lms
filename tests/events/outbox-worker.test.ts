import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pollOutboxEventsForProcessingMock = vi.fn();
const findEventDeliveryMock = vi.fn();
const insertEventDeliveryAttemptMock = vi.fn();
const insertDeadLetterEventMock = vi.fn();

vi.mock("@atlas/events/repositories/outbox.repository", () => ({
  pollOutboxEventsForProcessing: (...args: unknown[]) => pollOutboxEventsForProcessingMock(...args),
}));

vi.mock("@atlas/events/repositories/event-delivery.repository", () => ({
  findEventDelivery: (...args: unknown[]) => findEventDeliveryMock(...args),
  insertEventDeliveryAttempt: (...args: unknown[]) => insertEventDeliveryAttemptMock(...args),
}));

vi.mock("@atlas/events/repositories/dead-letter.repository", () => ({
  insertDeadLetterEvent: (...args: unknown[]) => insertDeadLetterEventMock(...args),
}));

import { processOutboxBatch } from "@atlas/events/services/outbox-worker.service";

const tx = { $queryRaw: vi.fn() };

const polledEvent = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenant_id: "018f0000-0000-7000-8000-000000000002",
  event_type: "course.published",
  aggregate_type: "course",
  aggregate_id: "018f0000-0000-7000-8000-000000000003",
  payload_json: { courseId: "018f0000-0000-7000-8000-000000000003" },
  metadata_json: { requestId: "req_worker_test" },
  idempotency_key: "idem_worker_test",
  occurred_at: new Date("2025-01-01T00:00:00.000Z"),
};

describe("processOutboxBatch", () => {
  beforeEach(() => {
    pollOutboxEventsForProcessingMock.mockReset();
    findEventDeliveryMock.mockReset();
    insertEventDeliveryAttemptMock.mockReset();
    insertDeadLetterEventMock.mockReset();
    tx.$queryRaw.mockReset();

    findEventDeliveryMock.mockResolvedValue(null);
    pollOutboxEventsForProcessingMock.mockResolvedValue([polledEvent]);
    insertEventDeliveryAttemptMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000010",
    });
    insertDeadLetterEventMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000011" });
  });

  it("polls available outbox events", async () => {
    pollOutboxEventsForProcessingMock.mockResolvedValue([]);

    const result = await processOutboxBatch(tx, {
      limit: 25,
      handlers: {},
      maxRetries: 3,
    });

    expect(pollOutboxEventsForProcessingMock).toHaveBeenCalledWith(tx, 25, []);
    expect(result).toEqual({ processed: 0, delivered: 0, failed: 0, skipped: 0 });
  });

  it("passes this group's subscriptions to the poll so it only claims its own undelivered work", async () => {
    // Without this the poll returned the oldest rows regardless of handler or
    // delivery state, so the outbox head-of-line blocked forever.
    pollOutboxEventsForProcessingMock.mockResolvedValue([]);

    await processOutboxBatch(tx, {
      limit: 25,
      handlers: {
        "course.published": [
          { destinationKey: "search.index", handle: vi.fn() },
          { destinationKey: "analytics.rollup", handle: vi.fn() },
        ],
        "user.registered": [{ destinationKey: "search.index", handle: vi.fn() }],
      },
      maxRetries: 3,
    });

    expect(pollOutboxEventsForProcessingMock).toHaveBeenCalledWith(tx, 25, [
      { eventType: "course.published", destinationKey: "search.index" },
      { eventType: "course.published", destinationKey: "analytics.rollup" },
      { eventType: "user.registered", destinationKey: "search.index" },
    ]);
  });

  it("inserts a succeeded event_deliveries row when the handler succeeds", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);

    const result = await processOutboxBatch(tx, {
      limit: 10,
      maxRetries: 3,
      handlers: {
        "course.published": [
          {
            destinationKey: "analytics.projection",
            handle,
          },
        ],
      },
    });

    expect(handle).toHaveBeenCalledWith({
      id: polledEvent.id,
      eventType: polledEvent.event_type,
      tenantId: polledEvent.tenant_id,
      payload: polledEvent.payload_json,
      requestId: "req_worker_test",
    });
    expect(insertEventDeliveryAttemptMock).toHaveBeenCalledWith(tx, {
      tenantId: polledEvent.tenant_id,
      outboxEventId: polledEvent.id,
      destinationKey: "analytics.projection",
      status: "SUCCEEDED",
      requestId: "req_worker_test",
    });
    expect(insertDeadLetterEventMock).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, delivered: 1, failed: 0, skipped: 0 });
  });

  it("inserts failed event_deliveries and dead_letter_events rows when the handler fails", async () => {
    const handle = vi.fn().mockRejectedValue(new Error("Destination unavailable"));

    const result = await processOutboxBatch(tx, {
      limit: 10,
      maxRetries: 3,
      handlers: {
        "course.published": [
          {
            destinationKey: "analytics.projection",
            handle,
          },
        ],
      },
    });

    expect(insertEventDeliveryAttemptMock).toHaveBeenCalledWith(tx, {
      tenantId: polledEvent.tenant_id,
      outboxEventId: polledEvent.id,
      destinationKey: "analytics.projection",
      status: "FAILED",
      errorCode: "HANDLER_FAILED",
      safeErrorMessage: "Destination unavailable",
      requestId: "req_worker_test",
    });
    expect(insertDeadLetterEventMock).toHaveBeenCalledWith(tx, {
      outboxEventId: polledEvent.id,
      tenantId: polledEvent.tenant_id,
      destinationKey: "analytics.projection",
      eventType: polledEvent.event_type,
      errorCode: "HANDLER_FAILED",
      safeErrorMessage: "Destination unavailable",
      retryCount: 1,
      requestId: "req_worker_test",
      payloadJson: polledEvent.payload_json,
    });
    expect(result).toEqual({ processed: 1, delivered: 0, failed: 1, skipped: 0 });
  });

  it("does not mutate the source outbox event row", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);

    await processOutboxBatch(tx, {
      limit: 10,
      maxRetries: 3,
      handlers: {
        "course.published": [
          {
            destinationKey: "analytics.projection",
            handle,
          },
        ],
      },
    });

    expect(pollOutboxEventsForProcessingMock).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(insertEventDeliveryAttemptMock).toHaveBeenCalledTimes(1);
    expect(insertDeadLetterEventMock).not.toHaveBeenCalled();
  });

  it("does not update or delete outbox events in the worker service", () => {
    const workerSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../backend/packages/events/src/services/outbox-worker.service.ts",
      ),
      "utf8",
    );

    expect(workerSource).not.toMatch(/UPDATE\s+outbox_events/i);
    expect(workerSource).not.toMatch(/DELETE\s+FROM\s+outbox_events/i);
    expect(workerSource).toContain("findEventDelivery");
    expect(workerSource).toContain("insertEventDeliveryAttempt");
    expect(workerSource).toContain("insertDeadLetterEvent");
  });

  it("skips handlers when a delivery row already exists", async () => {
    findEventDeliveryMock.mockResolvedValue({ status: "SENT" });
    const handle = vi.fn();

    const result = await processOutboxBatch(tx, {
      limit: 10,
      maxRetries: 3,
      handlers: {
        "course.published": [
          {
            destinationKey: "analytics.projection",
            handle,
          },
        ],
      },
    });

    expect(handle).not.toHaveBeenCalled();
    expect(insertEventDeliveryAttemptMock).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, delivered: 0, failed: 0, skipped: 1 });
  });
});
