import { expect, it, vi } from "vitest";
import { createPostHogOutboxHandler } from "@atlas/observability/posthog/outbox-mapper";
import { captureServerPostHogEventImmediate } from "@atlas/observability/posthog/server";

vi.mock("@atlas/observability/posthog/server", () => ({
  captureServerPostHogEvent: vi.fn(),
  captureServerPostHogEventImmediate: vi.fn(),
}));

it("retains the original event UUID across PostHog delivery retries", async () => {
  const event = {
    id: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "stable-key",
    attempt: 1,
    eventType: "lesson.completed",
    tenantId: null,
    requestId: "first",
    payload: {},
  };
  const handler = createPostHogOutboxHandler();
  await handler.handle(event);
  await handler.handle({ ...event, requestId: "retry" });
  expect(captureServerPostHogEventImmediate).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ uuid: event.id }),
  );
  expect(captureServerPostHogEventImmediate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ uuid: event.id }),
  );
});
