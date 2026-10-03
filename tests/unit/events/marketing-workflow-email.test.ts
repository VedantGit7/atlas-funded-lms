import { beforeEach, describe, expect, it, vi } from "vitest";
import { startSingleWorkflowRun } from "../../../backend/apps/api/src/server/marketing-workflows/marketing-workflow.engine";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";

const state = vi.hoisted(() => ({
  active: false,
  receipt: false,
  publish: vi.fn(),
  send: vi.fn(),
  insert: vi.fn(),
  log: vi.fn(),
  configured: true,
}));
const runId = "11111111-1111-4111-8111-111111111111";
const workflowId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
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
vi.mock("../../../backend/apps/api/src/server/notifications/notification.email-provider", () => ({
  getEmailProvider: () => ({ isConfigured: () => state.configured, send: state.send }),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.service", () => ({
  buildSafeInboxPayload: (input: unknown) => input,
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.repository", () => ({
  notificationRepository: {
    findDispatchByIdempotencyKey: async () => null,
    insertDispatch: state.insert,
  },
}));
vi.mock("../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: async () => ({
    fromName: "Academy",
    fromEmail: "from@example.test",
    replyToEmail: null,
  }),
}));
vi.mock("../../../backend/apps/api/src/server/marketing-events/marketing-events.service", () => ({
  registerMarketingEventFromWorkflow: vi.fn(),
}));
vi.mock(
  "../../../backend/apps/api/src/server/marketing-workflows/marketing-workflow.repository",
  () => ({
    marketingWorkflowRepository: {
      findById: async () => ({
        id: "22222222-2222-4222-8222-222222222222",
        status: "PUBLISHED",
        graph_json: {
          entryNodeId: "email",
          nodes: {
            email: {
              id: "email",
              type: "action",
              title: "Welcome",
              config: {
                actionType: "send_message",
                email: { subject: "Subject", bodyHtml: "<p>Body</p>" },
              },
              next: null,
            },
          },
        },
      }),
      findRunByIdempotency: async () => null,
      insertRun: async () => "11111111-1111-4111-8111-111111111111",
      findRun: async () => ({
        id: "11111111-1111-4111-8111-111111111111",
        membership_id: "33333333-3333-4333-8333-333333333333",
        current_node_id: "email",
        trigger_payload_json: {},
      }),
      resolveMembershipEmail: async () => ({ email: "recipient@example.test" }),
      updateRun: vi.fn(),
      insertLog: state.log,
      hasEmailReceipt: async () => {
        expect(state.active).toBe(true);
        return state.receipt;
      },
    },
  }),
);
const ctx = { tenantId: "tenant", actorMembershipId: memberId, requestId: "request" };
beforeEach(() => {
  state.active = false;
  state.receipt = false;
  state.configured = true;
  state.publish.mockReset().mockResolvedValue({ id: "child" });
  state.send.mockReset().mockResolvedValue(undefined);
  state.insert.mockReset().mockImplementation(async () => {
    expect(state.active).toBe(true);
  });
  state.log.mockReset().mockResolvedValue(undefined);
});

describe("workflow email scheduling", () => {
  it("queues immutable email content and stable action identity without sending inside the workflow", async () => {
    state.active = true;
    await startSingleWorkflowRun({} as never, ctx, {
      workflowId,
      membershipId: memberId,
      eventType: "membership.created",
      payload: {},
      sourceEventId: "source",
    });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.publish).toHaveBeenCalledOnce();
    expect(state.publish.mock.calls[0]?.[1]).toMatchObject({
      eventType: "marketing.workflow_email_requested",
      idempotencyKey: `marketing.workflow:${runId}:email`,
      payload: {
        runId,
        nodeId: "email",
        to: "recipient@example.test",
        subject: "Subject",
        body: "<p>Body</p>",
      },
    });
    expect(state.log.mock.calls.some((call) => call[1]?.status === "SENT")).toBe(false);
  });
  it("propagates enqueue failures instead of acknowledging a failed action", async () => {
    state.publish.mockRejectedValue(new Error("enqueue failed"));
    await expect(
      startSingleWorkflowRun({} as never, ctx, {
        workflowId,
        membershipId: memberId,
        eventType: "membership.created",
        payload: {},
        sourceEventId: "source",
      }),
    ).rejects.toThrow("enqueue failed");
    expect(state.send).not.toHaveBeenCalled();
  });
});

describe("workflow email delivery", () => {
  const event = {
    id: "44444444-4444-4444-8444-444444444444",
    eventType: "marketing.workflow_email_requested",
    tenantId: "tenant",
    requestId: "request",
    idempotencyKey: "core-key",
    attempt: 1,
    payload: {
      runId,
      nodeId: "email",
      actionTitle: "Welcome",
      membershipId: memberId,
      idempotencyKey: `marketing.workflow:${runId}:email`,
      to: "frozen@example.test",
      subject: "Subject",
      body: "<p>Body</p>",
      fromName: "Academy",
      fromEmail: "from@example.test",
      replyToEmail: null,
    },
  };
  const worker = () =>
    import("../../../backend/apps/api/src/server/marketing-workflows/marketing-workflow-email.worker");
  it("sends frozen content outside a transaction and persists a success receipt afterwards", async () => {
    state.send.mockImplementation(async () => {
      expect(state.active).toBe(false);
    });
    const { handleMarketingWorkflowEmailOutboxEvent, marketingWorkflowEmailOutboxHandlers } =
      await worker();
    await handleMarketingWorkflowEmailOutboxEvent(event);
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "frozen@example.test",
        body: "<p>Body</p>",
        idempotencyKey: event.payload.idempotencyKey,
      }),
    );
    expect(state.insert).toHaveBeenCalledOnce();
    expect(state.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "SENT" }),
    );
    expect(marketingWorkflowEmailOutboxHandlers[0]?.retryOnCrash).toBe(false);
  });
  it.each(["retryable", "permanent", "reconciliation_required"] as const)(
    "propagates %s provider failures without a success receipt",
    async (kind) => {
      state.send.mockRejectedValue(new OutboxDeliveryError(kind, "SMTP_TEST_FAILURE"));
      await expect(
        (await worker()).handleMarketingWorkflowEmailOutboxEvent(event),
      ).rejects.toMatchObject({ kind });
      expect(state.insert).not.toHaveBeenCalled();
      expect(state.log).not.toHaveBeenCalled();
    },
  );
  it("holds unknown SMTP or receipt failures for reconciliation", async () => {
    state.send.mockRejectedValue(new Error("unknown smtp result"));
    await expect(
      (await worker()).handleMarketingWorkflowEmailOutboxEvent(event),
    ).rejects.toMatchObject({ kind: "reconciliation_required" });
    state.send.mockResolvedValue(undefined);
    state.insert.mockRejectedValue(new Error("receipt failed"));
    await expect(
      (await worker()).handleMarketingWorkflowEmailOutboxEvent(event),
    ).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "WORKFLOW_EMAIL_RECEIPT_UNKNOWN",
    });
  });
  it("skips an already persisted contact receipt and rejects an unconfigured provider", async () => {
    state.receipt = true;
    await (
      await worker()
    ).handleMarketingWorkflowEmailOutboxEvent({
      ...event,
      payload: { ...event.payload, membershipId: null },
    });
    expect(state.send).not.toHaveBeenCalled();
    state.receipt = false;
    state.configured = false;
    await expect(
      (await worker()).handleMarketingWorkflowEmailOutboxEvent(event),
    ).rejects.toMatchObject({ kind: "permanent", code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(state.insert).not.toHaveBeenCalled();
  });
});
