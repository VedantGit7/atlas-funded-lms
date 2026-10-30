import { beforeEach, describe, expect, it, vi } from "vitest";
import { processNotificationSourceEvent } from "../../../backend/apps/api/src/server/notifications/notification.worker";
import { DEFAULT_ACADEMY_NAME } from "../../../backend/apps/api/src/server/notifications/security-notification.templates";

/**
 * A provisioned tenant had no branding row, and reading it threw, so every
 * security email it raised failed four times and was dead-lettered (staging,
 * 30 October 2026). The email goes out under the default academy name instead.
 */
const state = vi.hoisted(() => ({
  branding: null as null | { public_name: string | null; display_name: string },
  queued: vi.fn(),
}));

vi.mock("@atlas/db", () => ({ withTenantTx: vi.fn() }));
vi.mock("@atlas/membership", () => ({
  isMemberOptedOutOfCategory: async () => false,
  isMemberOptedOutOfChannel: async () => false,
  getMemberPreferences: vi.fn(),
}));
vi.mock("@atlas/domain-branding/repositories/branding.repository", () => ({
  getTenantBranding: async () => state.branding,
}));
vi.mock("../../../backend/apps/api/src/server/system-email/system-email.service", () => ({
  resolveSystemEmailForSend: async () => null,
}));
vi.mock("../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: vi.fn(),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.email-provider", () => ({
  channelSender: vi.fn(),
  getEmailProvider: vi.fn(),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.repository", () => ({
  notificationRepository: {
    findDispatchByIdempotencyKey: async () => null,
    insertDispatch: async () => ({ id: "22222222-2222-4222-8222-222222222222" }),
  },
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.service", () => ({
  buildRenderedTemplateContent: vi.fn(),
  buildSafeInboxPayload: (payload: unknown) => payload,
  publishNotificationQueuedEvent: state.queued,
}));

const ctx = {
  tenantId: "33333333-3333-4333-8333-333333333333",
  actorMembershipId: null,
  requestId: "req_security_email_branding",
} as never;

const event = {
  id: "44444444-4444-4444-8444-444444444444",
  eventType: "security.password_changed",
  payload: {
    membershipId: "55555555-5555-4555-8555-555555555555",
    email: "owner@example.test",
    siteUrl: "https://academy.example.test",
  },
};

function emailQueued(): { renderedPayload: { body: string } } {
  const call = state.queued.mock.calls.find(
    (args: unknown[]) => (args[2] as { channel: string }).channel === "email",
  );
  return call?.[2] as { renderedPayload: { body: string } };
}

beforeEach(() => {
  state.queued.mockReset();
  state.branding = null;
});

describe("security email without a branding row", () => {
  it("still queues the email, under the default academy name", async () => {
    await expect(processNotificationSourceEvent({} as never, ctx, event)).resolves.toBeUndefined();

    expect(emailQueued().renderedPayload.body).toContain(DEFAULT_ACADEMY_NAME);
  });

  it("uses the tenant's public name when it has branding", async () => {
    state.branding = { public_name: "Northwind Academy", display_name: "Northwind" };

    await processNotificationSourceEvent({} as never, ctx, event);

    expect(emailQueued().renderedPayload.body).toContain("Northwind Academy");
  });
});
