import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import type * as EmailProviderModule from "../../../backend/apps/api/src/server/notifications/notification.email-provider";
import {
  CHANNEL_TEST_EMAIL_TEMPLATE_ID,
  CHANNEL_TEST_EMAIL_TEMPLATE_KEY,
} from "../../../backend/apps/api/src/server/notifications/channel-test-email.contract";
import {
  describeEmailFailure,
  readChannelTestEmail,
  sendChannelTestEmail,
} from "../../../backend/apps/api/src/server/notifications/channel-test-email.service";
import { notificationQueuedOutboxPayloadSchema } from "../../../backend/apps/api/src/server/notifications/notification.dto";

/**
 * "Send test email" on the Transactional Email channel (staging, 30 October
 * 2026: the only way to test email was to change a password).
 */
const state = vi.hoisted(() => ({
  configured: true,
  send: vi.fn(),
  queued: vi.fn(),
  memberEmail: "admin@example.test" as string | null,
  dispatch: null as null | { status: string },
  jobRows: [] as Array<{ status: string | null; last_error_code: string | null }>,
}));

vi.mock("@atlas/domain-branding/repositories/branding.repository", () => ({
  getTenantBranding: async () => ({ public_name: "Northwind Academy", display_name: "Northwind" }),
}));
vi.mock("../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: async () => ({
    fromName: "Northwind Academy",
    fromEmail: "",
    replyToEmail: null,
  }),
}));
vi.mock(
  "../../../backend/apps/api/src/server/notifications/notification.email-provider",
  async (importOriginal) => ({
    channelSender: (await importOriginal<typeof EmailProviderModule>()).channelSender,
    getEmailProvider: () => ({ isConfigured: () => state.configured, send: state.send }),
  }),
);
vi.mock("../../../backend/apps/api/src/server/notifications/notification.repository", () => ({
  notificationRepository: {
    findMembershipEmail: async () => state.memberEmail,
    findDispatchByIdempotencyKey: async () => state.dispatch,
  },
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.service", () => ({
  publishNotificationQueuedEvent: state.queued,
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.worker", () => ({
  NOTIFICATION_QUEUED_WORKER_DESTINATION: "notifications.queued",
}));

const tx = { $queryRaw: vi.fn(async () => state.jobRows) } as never;
const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  actorMembershipId: "22222222-2222-4222-8222-222222222222",
  requestId: "req_channel_test_email",
};
const testId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  state.configured = true;
  state.send.mockReset();
  state.queued.mockReset();
  state.memberEmail = "admin@example.test";
  state.dispatch = null;
  state.jobRows = [];
});

describe("sending a test email now", () => {
  it("reports the mail server's acceptance, sent with the channel's sender", async () => {
    const result = await sendChannelTestEmail(tx, ctx, {
      mode: "direct",
      to: "inbox@example.test",
    });

    expect(result).toMatchObject({ mode: "direct", to: "inbox@example.test", status: "sent" });
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ctx.tenantId,
        to: "inbox@example.test",
        subject: "Test email from Northwind Academy",
        fromName: "Northwind Academy",
        // An empty From email falls back to NOTIFICATION_EMAIL_FROM.
        fromEmail: "",
      }),
    );
  });

  it("reports a refusal with the SMTP code instead of throwing", async () => {
    state.send.mockRejectedValue(new OutboxDeliveryError("permanent", "SMTP_550"));

    const result = await sendChannelTestEmail(tx, ctx, {
      mode: "direct",
      to: "inbox@example.test",
    });

    expect(result).toMatchObject({ status: "failed", errorCode: "SMTP_550" });
    expect(result.message).toContain("refused");
  });

  it("says so when no provider is configured", async () => {
    state.configured = false;

    const result = await sendChannelTestEmail(tx, ctx, {
      mode: "direct",
      to: "inbox@example.test",
    });

    expect(result).toMatchObject({ status: "failed", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(state.send).not.toHaveBeenCalled();
  });
});

describe("sending a test email through the queue", () => {
  it("queues an email to the admin for the notification worker", async () => {
    const result = await sendChannelTestEmail(tx, ctx, { mode: "queued" });

    expect(result).toMatchObject({ mode: "queued", to: "admin@example.test", status: "queued" });
    expect(state.queued).toHaveBeenCalledWith(
      tx,
      ctx,
      expect.objectContaining({
        channel: "email",
        templateId: CHANNEL_TEST_EMAIL_TEMPLATE_ID,
        templateKey: CHANNEL_TEST_EMAIL_TEMPLATE_KEY,
        membershipId: ctx.actorMembershipId,
        sourceEventId: result.testId,
        renderedPayload: expect.objectContaining({
          emailSubject: "Test email from Northwind Academy",
        }),
      }),
    );
    expect(state.send).not.toHaveBeenCalled();
  });

  it("refuses when the admin's account has no email address", async () => {
    state.memberEmail = null;

    await expect(sendChannelTestEmail(tx, ctx, { mode: "queued" })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("is a payload the worker accepts", () => {
    expect(
      notificationQueuedOutboxPayloadSchema.safeParse({
        channel: "email",
        templateId: CHANNEL_TEST_EMAIL_TEMPLATE_ID,
        templateKey: CHANNEL_TEST_EMAIL_TEMPLATE_KEY,
        membershipId: ctx.actorMembershipId,
        sourceEventId: testId,
        renderedPayload: {
          title: "Test email",
          body: "<p>Hi</p>",
          actionPath: "/",
          emailSubject: "Test",
        },
      }).success,
    ).toBe(true);
  });
});

describe("reading a queued test", () => {
  it("is sent once the worker recorded the dispatch", async () => {
    state.dispatch = { status: "SENT" };

    await expect(readChannelTestEmail(tx, ctx, testId)).resolves.toMatchObject({ status: "sent" });
  });

  it("is still queued while the job waits", async () => {
    state.jobRows = [{ status: "pending", last_error_code: null }];

    await expect(readChannelTestEmail(tx, ctx, testId)).resolves.toMatchObject({
      status: "queued",
    });
  });

  it("is failed with the worker's code once the job is dead", async () => {
    state.jobRows = [{ status: "dead", last_error_code: "SMTP_550" }];

    await expect(readChannelTestEmail(tx, ctx, testId)).resolves.toMatchObject({
      status: "failed",
      errorCode: "SMTP_550",
    });
  });

  it("is not found for a test this admin did not send", async () => {
    state.jobRows = [];

    await expect(readChannelTestEmail(tx, ctx, testId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("failure messages", () => {
  it.each([
    ["SMTP_550", "refused"],
    ["SMTP_421", "for now"],
    ["SMTP_ACCEPTANCE_UNKNOWN", "did not confirm"],
    ["SOMETHING_ELSE", "SOMETHING_ELSE"],
  ])("explains %s", (code, phrase) => {
    expect(describeEmailFailure(code)).toContain(phrase);
  });
});
