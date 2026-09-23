import { buildNotificationIdempotencyKey } from "../../../backend/apps/api/src/server/notifications/notification.keys";
import { describe, expect, it } from "vitest";
import {
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

describe("mark-archive helpers", () => {
  it("builds deterministic archive idempotency keys", async () => {
    const { buildArchiveReceiptIdempotencyKey } =
      await import("../../../backend/apps/api/src/server/notifications/notification.keys");
    const args = {
      dispatchId: "11111111-1111-1111-1111-111111111111",
      membershipId: "33333333-3333-3333-3333-333333333333",
    };
    expect(buildArchiveReceiptIdempotencyKey(args)).toBe(buildArchiveReceiptIdempotencyKey(args));
    expect(buildArchiveReceiptIdempotencyKey(args)).not.toBe(
      buildArchiveReceiptIdempotencyKey({
        ...args,
        membershipId: "44444444-4444-4444-4444-444444444444",
      }),
    );
  });

  it("extracts archivedAt from archive receipt payload", async () => {
    const { extractArchiveReceiptAt } =
      await import("../../../backend/apps/api/src/server/notifications/notification.dto");
    const archivedAt = "2026-06-20T12:00:00.000Z";
    expect(
      extractArchiveReceiptAt({
        archiveForDispatchId: "11111111-1111-1111-1111-111111111111",
        inbox: { archivedAt },
      }),
    ).toBe(archivedAt);
  });
});
