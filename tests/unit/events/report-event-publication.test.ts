import { expect, it, vi } from "vitest";
import { outbox } from "@atlas/events/services/outbox.service";
import { assertApprovedEventType as assertContractEventType } from "../../../frontend/packages/contracts/src/events/event-types";
import {
  REPORT_GENERATE_REQUESTED_EVENT,
  REPORT_RUN_SUCCEEDED_EVENT,
} from "@atlas/domain/reports/reports.events";

it.each([REPORT_GENERATE_REQUESTED_EVENT, REPORT_RUN_SUCCEEDED_EVENT])(
  "publishes %s through the real event allowlist and envelope",
  async (eventType) => {
    const id = "11111111-1111-4111-8111-111111111111";
    const query = vi.fn().mockResolvedValue([{ id }]);
    await expect(
      outbox.publish(
        { $queryRaw: query },
        {
          ctx: { tenantId: id, requestId: "report-publication" },
          eventType,
          aggregateType: "report_run",
          aggregateId: id,
          payload: { reportRunId: id },
          idempotencyKey: `${eventType}:${id}`,
        },
      ),
    ).resolves.toEqual({ id });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]).toContain(eventType);
    expect(() => assertContractEventType(eventType)).not.toThrow();
  },
);
