import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MARKETING_EMAIL_ENABLED=false (launch plan task 1.6): marketing email shares
 * the transactional SMTP setting, and ZeptoMail allows only transactional mail.
 * Every marketing send path refuses before anything goes out; every other
 * email path keeps sending.
 */
const state = vi.hoisted(() => ({
  send: vi.fn(),
  emailRepository: {
    findById: vi.fn(),
    listDueScheduled: vi.fn(),
    listRecipientDeliveryTargets: vi.fn(),
    markSent: vi.fn(),
    markScheduled: vi.fn(),
    create: vi.fn(),
  },
  campaignRow: null as Record<string, unknown> | null,
  updateTouchpoints: vi.fn(),
  push: vi.fn(),
  announcement: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("../../../backend/apps/api/src/server/notifications/notification.email-provider", () => ({
  getEmailProvider: () => ({ isConfigured: () => true, send: state.send }),
}));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.repository", () => ({
  notificationRepository: {
    findDispatchByIdempotencyKey: async () => null,
    insertDispatch: state.dispatch,
  },
}));
vi.mock("../../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: async () => ({
    fromName: "Academy",
    fromEmail: "from@example.test",
    replyToEmail: null,
  }),
}));
vi.mock("../../../backend/apps/api/src/server/marketing-email/marketing-email.repository", () => ({
  marketingEmailRepository: state.emailRepository,
}));
vi.mock(
  "../../../backend/apps/api/src/server/marketing-campaigns/marketing-campaigns.repository",
  () => ({
    marketingCampaignsRepository: {
      findById: async () => state.campaignRow,
      updateTouchpoints: state.updateTouchpoints,
    },
  }),
);
vi.mock("../../../backend/apps/api/src/server/push-messages/push-messages.service", () => ({
  composePushMessage: state.push,
  createPushMessage: state.push,
  sendPushMessage: state.push,
  setPushMessageAudience: state.push,
}));
vi.mock("../../../backend/apps/api/src/server/announcements/announcements.service", () => ({
  createAndSendAnnouncement: state.announcement,
}));
vi.mock("@atlas/domain/reports/sales-marketing-roster.service", () => ({
  createSalesPurchaserGroup: vi.fn(),
  resolveSalesPurchaserMembershipIds: async () => ["member-1"],
}));

const { isMarketingEmailEnabled, MARKETING_EMAIL_DISABLED_MESSAGE } =
  await import("../../../backend/apps/api/src/server/marketing-email/marketing-email-sending");
const { sendMarketingEmail, processDueScheduledMarketingEmails } =
  await import("../../../backend/apps/api/src/server/marketing-email/marketing-email.service");
const { launchMarketingCampaign, updateMarketingCampaignTouchpoints } =
  await import("../../../backend/apps/api/src/server/marketing-campaigns/marketing-campaigns.service");
const { sendSalesMarketingMessage } =
  await import("../../../backend/apps/api/src/server/reports/sales-marketing-roster-actions.service");

const tx = {} as never;
const ctx = { tenantId: "tenant", actorMembershipId: "actor", requestId: "request" };
const campaignId = "55555555-5555-4555-8555-555555555555";

function draftCampaign(channels: string[]) {
  const now = new Date();
  return {
    id: campaignId,
    title: "Spring",
    goal: "CONVERSION",
    status: "DRAFT",
    audience_type: "ALL",
    audience_batch_id: null,
    audience_label: null,
    recipient_count: 0,
    channels_json: Object.fromEntries(channels.map((channel) => [channel, true])),
    // Push goes first, so a refusal found only at the email touchpoint would
    // already have sent it.
    touchpoints_json: channels.map((channel, index) => ({
      id: `tp-${channel}`,
      channel,
      title: channel,
      delayDays: index,
    })),
    launched_at: null,
    scheduled_at: null,
    created_by_membership_id: "actor",
    created_at: now,
    updated_at: now,
  };
}

beforeEach(() => {
  for (const spy of [
    state.send,
    state.updateTouchpoints,
    state.push,
    state.announcement,
    state.dispatch,
    ...Object.values(state.emailRepository),
  ])
    spy.mockReset();
  state.emailRepository.listDueScheduled.mockResolvedValue([]);
  state.emailRepository.listRecipientDeliveryTargets.mockResolvedValue([
    { membershipId: "member-1", email: "learner@example.test", displayName: "Ada" },
  ]);
  state.send.mockResolvedValue(undefined);
  state.campaignRow = null;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the marketing email switch", () => {
  it("is on unless set to exactly false", () => {
    expect(isMarketingEmailEnabled({})).toBe(true);
    expect(isMarketingEmailEnabled({ MARKETING_EMAIL_ENABLED: "true" })).toBe(true);
    expect(isMarketingEmailEnabled({ MARKETING_EMAIL_ENABLED: "false" })).toBe(false);
  });

  it.each([
    { mode: "now" },
    { mode: "schedule", scheduledAt: "2099-01-01T00:00:00.000Z" },
    { mode: "test", testEmail: "me@example.test" },
  ])("refuses an email campaign send in $mode mode before reading it", async (body) => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
    await expect(sendMarketingEmail(tx, ctx, campaignId, body)).rejects.toMatchObject({
      status: 400,
      message: MARKETING_EMAIL_DISABLED_MESSAGE,
    });
    expect(state.emailRepository.findById).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("leaves campaigns scheduled earlier unsent", async () => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
    await processDueScheduledMarketingEmails(tx, ctx);
    expect(state.emailRepository.listDueScheduled).not.toHaveBeenCalled();

    vi.stubEnv("MARKETING_EMAIL_ENABLED", "true");
    await processDueScheduledMarketingEmails(tx, ctx);
    expect(state.emailRepository.listDueScheduled).toHaveBeenCalledOnce();
  });

  it("refuses to launch a campaign with an email touchpoint before any touchpoint sends", async () => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
    state.campaignRow = draftCampaign(["push", "email"]);
    await expect(launchMarketingCampaign(tx, ctx, campaignId, { mode: "now" })).rejects.toThrow(
      MARKETING_EMAIL_DISABLED_MESSAGE,
    );
    expect(state.push).not.toHaveBeenCalled();
    expect(state.emailRepository.create).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("refuses the email channel in a campaign's touchpoints, but not the others", async () => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
    state.campaignRow = draftCampaign([]);
    const touchpoint = { id: "tp-1", channel: "push", title: "Nudge", delayDays: 0 };
    await expect(
      updateMarketingCampaignTouchpoints(tx, ctx, campaignId, {
        channels: { email: true, push: true },
        touchpoints: [touchpoint],
      }),
    ).rejects.toThrow(MARKETING_EMAIL_DISABLED_MESSAGE);
    expect(state.updateTouchpoints).not.toHaveBeenCalled();

    await updateMarketingCampaignTouchpoints(tx, ctx, campaignId, {
      channels: { push: true },
      touchpoints: [touchpoint],
    });
    expect(state.updateTouchpoints).toHaveBeenCalledOnce();
  });

  it("keeps a report's message to purchasers sending", async () => {
    vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
    await sendSalesMarketingMessage(tx, ctx, {
      membershipIds: ["66666666-6666-4666-8666-666666666666"],
      subject: "Your course",
      message: "Hello",
    });
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "learner@example.test", subject: "Your course" }),
    );
  });

  it("is consulted only by the marketing send paths", () => {
    // Login, notification, certificate, system and report email never read
    // the switch, so turning it off cannot stop them.
    const root = join(import.meta.dirname, "../../..");
    const server = join(root, "backend/apps/api/src");
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".ts")) files.push(path);
      }
    };
    walk(server);
    const readers = files
      .filter((file) => readFileSync(file, "utf8").includes("marketing-email-sending"))
      .map((file) => relative(server, file).replaceAll("\\", "/"))
      .sort();
    expect(readers).toEqual([
      "server/marketing-campaigns/marketing-campaigns.service.ts",
      "server/marketing-email/marketing-email.service.ts",
      "server/marketing-workflows/marketing-workflow-email.worker.ts",
      "server/marketing-workflows/marketing-workflow.engine.ts",
    ]);
  });
});
