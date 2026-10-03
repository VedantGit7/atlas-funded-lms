import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleMarketingWebhookOutboxEvent,
  marketingWebhookOutboxHandlers,
} from "../../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.worker";

const state = vi.hoisted(() => ({
  active: false,
  publish: vi.fn(),
  fetch: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@atlas/db", () => ({
  withTenantTx: async (_scope: unknown, fn: (tx: object) => Promise<unknown>) => {
    expect(state.active).toBe(false);
    state.active = true;
    try {
      return await fn({});
    } finally {
      state.active = false;
    }
  },
}));
vi.mock("@atlas/events", () => ({ publishOutboxEvent: state.publish }));
vi.mock("@atlas/security/safe-outbound-fetch", () => ({ safeOutboundFetch: state.fetch }));
vi.mock(
  "../../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.repository",
  () => ({
    marketingIntegrationsRepository: {
      listEnabledWebhooksForEvent: async () => [
        { id: "11111111-1111-4111-8111-111111111111", url: "https://one.example/hook" },
        { id: "22222222-2222-4222-8222-222222222222", url: "https://two.example/hook" },
      ],
      markWebhookDelivery: async () => {
        expect(state.active).toBe(true);
      },
      insertDelivery: state.insert,
    },
  }),
);
const base = {
  id: "33333333-3333-4333-8333-333333333333",
  tenantId: "tenant",
  requestId: "request",
  eventType: "marketing.webhook_dispatch_requested",
  payload: { eventKey: "sign_up", data: { member: "test" }, schemaVersion: 1 },
};
const child = {
  ...base,
  payload: {
    ...base.payload,
    delivery: {
      webhookId: "11111111-1111-4111-8111-111111111111",
      url: "https://one.example/hook",
      idempotencyKey: "stable-endpoint-key",
      requestBody: '{"event":"sign_up","data":{"member":"test"}}',
    },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  state.active = false;
  state.publish.mockImplementation(async () => {
    expect(state.active).toBe(true);
  });
  state.fetch.mockReset().mockImplementation(async () => {
    expect(state.active).toBe(false);
    return { ok: true, status: 200 };
  });
  state.insert.mockReset().mockImplementation(async () => {
    expect(state.active).toBe(true);
  });
});
describe("marketing endpoint delivery", () => {
  it("materializes separate immutable jobs for each endpoint without sending", async () => {
    await handleMarketingWebhookOutboxEvent(base);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.publish).toHaveBeenCalledTimes(2);
    const first = state.publish.mock.calls[0]?.[1];
    const second = state.publish.mock.calls[1]?.[1];
    expect(first.payload.delivery.url).toBe("https://one.example/hook");
    expect(first.payload.delivery.requestBody).toContain('"event":"sign_up"');
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    await handleMarketingWebhookOutboxEvent({ ...base, requestId: "new-request" });
    expect(state.publish.mock.calls[2]?.[1].idempotencyKey).toBe(first.idempotencyKey);
  });
  it("sends the frozen body and stable key outside a transaction then persists outcome", async () => {
    await handleMarketingWebhookOutboxEvent(child);
    expect(state.fetch.mock.calls[0]?.[1]).toMatchObject({
      body: child.payload.delivery.requestBody,
      headers: { "idempotency-key": "stable-endpoint-key" },
    });
    expect(state.insert).toHaveBeenCalledOnce();
    expect(marketingWebhookOutboxHandlers[0]?.retryOnCrash).toBe(false);
  });
  it.each([
    [429, "retryable"],
    [401, "permanent"],
    [503, "reconciliation_required"],
  ])("does not acknowledge HTTP %s as delivered", async (status, kind) => {
    state.fetch.mockResolvedValue({ ok: false, status });
    await expect(handleMarketingWebhookOutboxEvent(child)).rejects.toMatchObject({ kind });
    expect(state.insert).toHaveBeenCalledOnce();
  });
  it("holds unknown acceptance and receipt failures", async () => {
    state.fetch.mockRejectedValue(new Error("network timeout"));
    await expect(handleMarketingWebhookOutboxEvent(child)).rejects.toMatchObject({
      kind: "reconciliation_required",
    });
    state.fetch.mockResolvedValue({ ok: true, status: 200 });
    state.insert.mockRejectedValue(new Error("db unavailable"));
    await expect(handleMarketingWebhookOutboxEvent(child)).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "WEBHOOK_RECEIPT_UNKNOWN",
    });
  });
});
