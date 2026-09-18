import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertOutboxEventMock = vi.fn();

vi.mock("@atlas/events/repositories/outbox.repository", () => ({
  insertOutboxEvent: (...args: unknown[]) => insertOutboxEventMock(...args),
}));

import { outbox } from "@atlas/events/services/outbox.service";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const aggregateId = "018f0000-0000-7000-8000-000000000002";
const membershipId = "018f0000-0000-7000-8000-000000000003";
const requestId = "req_outbox_publish_test";
const idempotencyKey = "idem_outbox_publish_test";

const tx = { $queryRaw: vi.fn() };

describe("outbox.publish", () => {
  beforeEach(() => {
    insertOutboxEventMock.mockReset();
    insertOutboxEventMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("publishes an approved event type successfully", async () => {
    await expect(
      outbox.publish(tx, {
        ctx: {
          tenantId,
          actorMembershipId: membershipId,
          requestId,
        },
        eventType: "course.published",
        aggregateType: "course",
        aggregateId,
        payload: { courseId: aggregateId },
        idempotencyKey,
      }),
    ).resolves.toEqual({ id: "018f0000-0000-7000-8000-000000000099" });

    expect(insertOutboxEventMock).toHaveBeenCalledTimes(1);
  });

  it("publishes security notification event types", async () => {
    await expect(
      outbox.publish(tx, {
        ctx: {
          tenantId,
          actorMembershipId: membershipId,
          requestId,
        },
        eventType: "security.mfa_enabled",
        aggregateType: "security_notification",
        aggregateId: membershipId,
        payload: {
          membershipId,
          email: "member@example.com",
        },
        idempotencyKey: `${idempotencyKey}:mfa`,
      }),
    ).resolves.toEqual({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("rejects an unapproved event type", async () => {
    await expect(
      outbox.publish(tx, {
        ctx: {
          tenantId,
          requestId,
        },
        eventType: "course.not.approved",
        aggregateType: "course",
        aggregateId,
        payload: { courseId: aggregateId },
      }),
    ).rejects.toThrow("Unapproved outbox event type: course.not.approved");

    expect(insertOutboxEventMock).not.toHaveBeenCalled();
  });

  it("persists idempotencyKey and requestId in metadataJson", async () => {
    await outbox.publish(tx, {
      ctx: {
        tenantId,
        actorMembershipId: membershipId,
        requestId,
      },
      eventType: "course.published",
      aggregateType: "course",
      aggregateId,
      payload: { courseId: aggregateId },
      idempotencyKey,
    });

    expect(insertOutboxEventMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        idempotencyKey,
        metadataJson: expect.objectContaining({
          requestId,
          idempotencyKey,
        }),
      }),
    );
  });

  it("does not run direct side effects", () => {
    const serviceSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/events/src/services/outbox.service.ts",
      ),
      "utf8",
    );

    expect(serviceSource).not.toMatch(/\bfetch\s*\(/);
    expect(serviceSource).not.toMatch(/\baxios\b/);
    expect(serviceSource).not.toMatch(/\bnotify\b/i);
    expect(serviceSource).not.toMatch(/\bsendEmail\b/i);
    expect(serviceSource).toContain("insertOutboxEvent");
  });
});
