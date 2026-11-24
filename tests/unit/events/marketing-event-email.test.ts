import { afterEach, describe, expect, it, vi } from "vitest";
import { OutboxDeliveryError } from "@atlas/events/services/outbox-worker.service";
import {
  formatEventWhen,
  safeTimeZone,
  timeZoneLongName,
} from "../../../backend/apps/api/src/server/marketing-events/marketing-event-time";

const state = vi.hoisted(() => ({ configured: true, send: vi.fn() }));
vi.mock("../../../backend/apps/api/src/server/notifications/notification.email-provider", () => ({
  getEmailProvider: () => ({ isConfigured: () => state.configured, send: state.send }),
  channelSender: (channel: { fromName: string; fromEmail: string }) => channel,
}));

const {
  buildMarketingEventEmail,
  handleMarketingEventEmailOutboxEvent,
  marketingEventEmailOutboxHandlers,
  MARKETING_EVENT_EMAIL_REQUESTED_EVENT,
} = await import("../../../backend/apps/api/src/server/marketing-events/marketing-event-email");

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Risk <b>management</b> & you",
  starts_at: new Date("2026-12-01T13:00:00Z"),
  ends_at: new Date("2026-12-01T14:30:00Z"),
  location: "Online",
  join_url: "https://meet.example.com/risk",
};

describe("event times (QA review 2 H29)", () => {
  it("names the academy's zone", () => {
    expect(formatEventWhen(event.starts_at, event.ends_at, "Asia/Kolkata")).toBe(
      "Tuesday, 1 December 2026, 6:30 pm – 8:00 pm (India Standard Time)",
    );
    expect(formatEventWhen(event.starts_at, null, "UTC")).toBe(
      "Tuesday, 1 December 2026, 1:00 pm (Coordinated Universal Time)",
    );
  });

  it("repeats the date when the event ends on another day", () => {
    expect(formatEventWhen(event.starts_at, new Date("2026-12-02T03:00:00Z"), "Asia/Kolkata")).toBe(
      "Tuesday, 1 December 2026, 6:30 pm – Wednesday, 2 December 2026, 8:30 am (India Standard Time)",
    );
  });

  it("falls back to UTC for a zone that isn't real", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
    expect(timeZoneLongName("Mars/Olympus")).toBe("Coordinated Universal Time");
  });
});

describe("event emails", () => {
  it("writes a confirmation with the time, place and join link, escaped", () => {
    const { subject, html } = buildMarketingEventEmail({
      kind: "confirmation",
      academyName: "Northwind Academy",
      recipientName: "Asha",
      event,
      timeZone: "Asia/Kolkata",
      siteUrl: "https://academy.example.com/",
    });
    expect(subject).toBe("You're registered: Risk <b>management</b> & you");
    expect(html).toContain("Northwind Academy");
    expect(html).toContain("Hi Asha,");
    expect(html).toContain("India Standard Time");
    expect(html).toContain("Online");
    expect(html).toContain('href="https://meet.example.com/risk"');
    expect(html).toContain(`https://academy.example.com/events/${event.id}`);
    expect(html).not.toContain("<b>management</b>");
    expect(html).toContain("Risk &lt;b&gt;management&lt;/b&gt; &amp; you");
  });

  it("links to the event page when there is no join link, and says nothing about a site it doesn't know", () => {
    const withPage = buildMarketingEventEmail({
      kind: "reminder",
      academyName: null,
      recipientName: null,
      event: { ...event, join_url: null, location: null },
      timeZone: "UTC",
      siteUrl: "https://academy.example.com",
    });
    expect(withPage.subject).toBe("Starting soon: Risk <b>management</b> & you");
    expect(withPage.html).toContain("View the event");
    expect(withPage.html).not.toContain("Where");

    const noLinks = buildMarketingEventEmail({
      kind: "reminder",
      academyName: null,
      recipientName: null,
      event: { ...event, join_url: null },
      timeZone: "UTC",
      siteUrl: null,
    });
    expect(noLinks.html).not.toContain("<a ");
  });
});

describe("event email delivery", () => {
  afterEach(() => {
    state.configured = true;
    state.send.mockReset();
  });

  const outboxEvent = {
    id: "e1",
    tenantId: "22222222-2222-4222-8222-222222222222",
    eventType: MARKETING_EVENT_EMAIL_REQUESTED_EVENT,
    requestId: "req",
    payload: {
      kind: "confirmation",
      eventId: event.id,
      registrationId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "marketing.event_email:confirmation:33333333-3333-4333-8333-333333333333",
      to: "asha@example.com",
      subject: "You're registered",
      body: "<p>Hi</p>",
      fromName: "Academy",
      fromEmail: "events@example.com",
      replyToEmail: null,
    },
  } as unknown as Parameters<typeof handleMarketingEventEmailOutboxEvent>[0];

  it("sends once, at most (no retry after a crash)", async () => {
    await handleMarketingEventEmailOutboxEvent(outboxEvent);
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "asha@example.com",
        idempotencyKey: "marketing.event_email:confirmation:33333333-3333-4333-8333-333333333333",
        tenantId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(marketingEventEmailOutboxHandlers[0]?.retryOnCrash).toBe(false);
  });

  it("fails for good when no email provider is set up", async () => {
    state.configured = false;
    await expect(handleMarketingEventEmailOutboxEvent(outboxEvent)).rejects.toBeInstanceOf(
      OutboxDeliveryError,
    );
    expect(state.send).not.toHaveBeenCalled();
  });

  it("doesn't retry when the provider may already have accepted it", async () => {
    state.send.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(handleMarketingEventEmailOutboxEvent(outboxEvent)).rejects.toMatchObject({
      message: expect.stringContaining("EVENT_EMAIL_ACCEPTANCE_UNKNOWN"),
    });
  });
});
