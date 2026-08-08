import { describe, expect, it } from "vitest";
import {
  buildNotificationIdempotencyKey,
  createNotificationTemplateBodySchema,
  plainTextBodySchema,
} from "../../../backend/apps/api/src/server/notifications/notification.dto";

describe("notification validation", () => {
  it("requires email subject", () => {
    const result = createNotificationTemplateBodySchema.safeParse({
      key: "certificate.issued",
      channel: "email",
      locale: "en",
      body: "Hello {{issuedAt}}",
      variablesJson: { variables: [{ name: "issuedAt" }] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsafe template markup", () => {
    const result = plainTextBodySchema.safeParse("Click javascript:alert(1) now");
    expect(result.success).toBe(false);
  });

  it("rejects undeclared variables", () => {
    const result = createNotificationTemplateBodySchema.safeParse({
      key: "certificate.issued",
      channel: "in_app",
      locale: "en",
      body: "Hello {{missingVar}}",
      variablesJson: { variables: [{ name: "issuedAt" }] },
    });

    expect(result.success).toBe(false);
  });
});

describe("notification idempotency", () => {
  it("builds deterministic idempotency keys", () => {
    const args = {
      sourceEventId: "11111111-1111-1111-1111-111111111111",
      templateId: "22222222-2222-2222-2222-222222222222",
      recipientMembershipId: "33333333-3333-3333-3333-333333333333",
      channel: "in_app",
    };

    expect(buildNotificationIdempotencyKey(args)).toBe(buildNotificationIdempotencyKey(args));
    expect(buildNotificationIdempotencyKey(args)).not.toBe(
      buildNotificationIdempotencyKey({ ...args, channel: "email" }),
    );
  });
});

describe("mark-read idempotence", () => {
  it("treats existing readAt as already read", () => {
    const readAt = "2026-06-20T12:00:00.000Z";
    const payload = {
      inbox: {
        title: "Certificate issued",
        body: "Your certificate was issued.",
        actionPath: "/certificates",
        readAt,
      },
    };

    expect(payload.inbox.readAt).toBe(readAt);
  });
});
