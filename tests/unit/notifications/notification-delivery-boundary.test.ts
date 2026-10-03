import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleNotificationQueuedOutboxEvent,
  notificationQueuedOutboxHandlers,
} from "../../../backend/apps/api/src/server/notifications/notification.worker";

const state = vi.hoisted(() => ({
  active: false,
  commits: 0,
  existing: null as null | { status: string },
  failPersist: false,
  sends: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@atlas/db", () => ({
  withTenantTx: async (_ctx: unknown, fn: (tx: object) => Promise<unknown>) => {
    expect(state.active).toBe(false);
    state.active = true;
    try {
      const result = await fn({});
      state.commits++;
      return result;
    } finally {
      state.active = false;
    }
  },
}));
vi.mock("@atlas/membership", () => ({}));
vi.mock("@atlas/domain-branding/services/branding-read.service", () => ({}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.service", () => ({}));
vi.mock("../../../backend/apps/api/src/server/system-email/system-email.service", () => ({}));
vi.mock("../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: async () => ({
    fromName: "Academy",
    fromEmail: "from@test.example",
    replyToEmail: null,
  }),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.email-provider", () => ({
  getEmailProvider: () => ({ isConfigured: () => true, send: state.sends }),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.repository", () => ({
  notificationRepository: {
    findDispatchByIdempotencyKey: async () => {
      expect(state.active).toBe(true);
      return state.existing;
    },
    findMembershipEmail: async () => "recipient@test.example",
    insertDispatch: state.insert,
  },
}));

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  eventType: "notification.queued",
  tenantId: "tenant",
  requestId: "request",
  payload: {
    channel: "email",
    templateId: "22222222-2222-4222-8222-222222222222",
    templateKey: "certificate.issued",
    membershipId: "33333333-3333-4333-8333-333333333333",
    sourceEventId: "11111111-1111-4111-8111-111111111111",
    renderedPayload: { title: "Title", body: "Body", actionPath: "/", emailSubject: "Subject" },
  },
};

beforeEach(() => {
  state.active = false;
  state.commits = 0;
  state.existing = null;
  state.failPersist = false;
  state.sends.mockReset().mockImplementation(async () => {
    expect(state.active).toBe(false);
    expect(state.commits).toBe(1);
  });
  state.insert.mockReset().mockImplementation(async () => {
    expect(state.active).toBe(true);
    if (state.failPersist) throw new Error("db write failed");
    return { id: "receipt" };
  });
});

describe("notification delivery transaction boundary", () => {
  it("commits preparation before sending and persists success separately", async () => {
    await handleNotificationQueuedOutboxEvent(event);
    expect(state.sends).toHaveBeenCalledOnce();
    expect(state.sends.mock.calls[0]?.[0].idempotencyKey).toBeTruthy();
    expect(state.commits).toBe(2);
    expect(state.insert.mock.calls[0]?.[1].status).toBe("SENT");
    expect(notificationQueuedOutboxHandlers[0]?.retryOnCrash).toBe(false);
  });
  it("does not acknowledge an existing FAILED dispatch as success", async () => {
    state.existing = { status: "FAILED" };
    await expect(handleNotificationQueuedOutboxEvent(event)).rejects.toMatchObject({
      kind: "permanent",
      code: "NOTIFICATION_DISPATCH_FAILED",
    });
    expect(state.sends).not.toHaveBeenCalled();
  });
  it("holds delivery when SMTP succeeded but receipt persistence failed", async () => {
    state.failPersist = true;
    await expect(handleNotificationQueuedOutboxEvent(event)).rejects.toMatchObject({
      kind: "reconciliation_required",
      code: "NOTIFICATION_RECEIPT_UNKNOWN",
    });
    expect(state.sends).toHaveBeenCalledOnce();
  });
  it("does not resend a successful dispatch", async () => {
    state.existing = { status: "SENT" };
    await handleNotificationQueuedOutboxEvent(event);
    expect(state.sends).not.toHaveBeenCalled();
  });
});
