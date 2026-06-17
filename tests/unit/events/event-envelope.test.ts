import { describe, expect, it } from "vitest";
import { OutboxEventEnvelopeSchema } from "@atlas/events/schemas/event-envelope";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const eventId = "018f0000-0000-7000-8000-000000000002";
const aggregateId = "018f0000-0000-7000-8000-000000000003";

const validEnvelope = {
  eventId,
  tenantId,
  eventType: "course.published",
  aggregateType: "course",
  aggregateId,
  actorMembershipId: null,
  occurredAt: new Date().toISOString(),
  schemaVersion: 1,
  payloadJson: { courseId: aggregateId },
  metadataJson: {
    requestId: "req_envelope_test",
  },
  idempotencyKey: "idem_envelope_test",
};

describe("OutboxEventEnvelopeSchema", () => {
  it("accepts a valid envelope", () => {
    expect(OutboxEventEnvelopeSchema.parse(validEnvelope)).toMatchObject({
      eventType: "course.published",
      schemaVersion: 1,
      metadataJson: {
        requestId: "req_envelope_test",
      },
    });
  });

  it("rejects a missing requestId", () => {
    expect(() =>
      OutboxEventEnvelopeSchema.parse({
        ...validEnvelope,
        metadataJson: {},
      }),
    ).toThrow();
  });

  it("rejects a missing schemaVersion", () => {
    expect(() =>
      OutboxEventEnvelopeSchema.parse({
        ...validEnvelope,
        schemaVersion: undefined,
      }),
    ).toThrow();
  });

  it("rejects an invalid tenantId", () => {
    expect(() =>
      OutboxEventEnvelopeSchema.parse({
        ...validEnvelope,
        tenantId: "not-a-uuid",
      }),
    ).toThrow();
  });
});
