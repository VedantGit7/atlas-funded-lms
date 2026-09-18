import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { APPROVED_EVENT_TYPES } from "@atlas/events/event-types";
import {
  MARKETING_WEBHOOK_DISPATCH_EVENT,
  MARKETING_WEBHOOK_WORKER_DESTINATION,
  marketingWebhookDispatchPayloadSchema,
} from "../../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.events";

/**
 * Regression test for the inline webhook fan-out found on 2026-08-19.
 *
 * `dispatchMarketingIntegrationWebhooks` used to loop over every enabled
 * webhook and await an 8 s-timeout HTTP call for each, sequentially, inside the
 * caller's tenant transaction — on the public signup route and the enrollment
 * path. Five slow or dead tenant-configured URLs pinned a pooled database
 * connection for up to 40 s on an unauthenticated request: the C6 shape Phase 1
 * measured at 0 rps and a 10 s stall.
 *
 * The property that matters is structural — the request path must enqueue, not
 * deliver — so it is asserted against the module rather than by timing a
 * request.
 */

const dispatchSource = readFileSync(
  "backend/apps/api/src/server/marketing-integrations/marketing-integrations.dispatch.ts",
  "utf8",
);

function bodyOf(functionName: string): string {
  const start = dispatchSource.indexOf(`export async function ${functionName}(`);
  expect(start, `${functionName} must exist`).toBeGreaterThan(-1);
  const next = dispatchSource.indexOf("\nexport async function ", start + 1);
  return dispatchSource.slice(start, next === -1 ? dispatchSource.length : next);
}

describe("marketing webhook fan-out runs through the outbox", () => {
  it("registers the event type in the outbox allowlist", () => {
    // `publishOutboxEvent` rejects unapproved types at runtime, so an
    // unregistered event would fail every signup rather than skip delivery.
    expect(APPROVED_EVENT_TYPES.has(MARKETING_WEBHOOK_DISPATCH_EVENT)).toBe(true);
    expect(MARKETING_WEBHOOK_WORKER_DESTINATION).toBe("marketing.webhooks");
  });

  it("validates the dispatch payload", () => {
    const ok = marketingWebhookDispatchPayloadSchema.safeParse({
      eventKey: "sign_up",
      data: { email: "learner@example.test" },
      schemaVersion: 1,
    });
    expect(ok.success).toBe(true);

    expect(
      marketingWebhookDispatchPayloadSchema.safeParse({
        eventKey: "not_a_real_event",
        data: {},
        schemaVersion: 1,
      }).success,
    ).toBe(false);
  });

  it("enqueues from the request path without performing delivery", () => {
    const requestPath = bodyOf("dispatchMarketingIntegrationWebhooks");

    expect(requestPath).toContain("publishOutboxEvent");
    // The regression: any of these in the request path means fan-out is being
    // done inline again, holding the transaction across network I/O.
    expect(requestPath).not.toContain("deliverWebhook(");
    expect(requestPath).not.toContain("safeOutboundFetch(");
  });

  it("performs delivery only in the worker-side function", () => {
    const workerPath = bodyOf("deliverMarketingIntegrationWebhooks");

    expect(workerPath).toContain("deliverWebhook(");
    expect(workerPath).not.toContain("publishOutboxEvent");
  });
});
