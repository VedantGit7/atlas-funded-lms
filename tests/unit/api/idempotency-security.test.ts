import { describe, expect, it, vi } from "vitest";
import { fingerprintRequest, withIdempotency } from "@atlas/api/idempotency-registry";

const claim = {
  tenantId: "tenant-a",
  actorMembershipId: "member-a",
  idempotencyKey: "operation-1",
  scope: "POST /api/v1/action",
  requestFingerprint: fingerprintRequest({ method: "POST", path: "/api/v1/action", body: {} }),
};

function existingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-a",
    status: "COMPLETED",
    actor_membership_id: "member-a",
    scope: claim.scope,
    request_fingerprint: claim.requestFingerprint,
    response_json: { privateResult: "member-a-result" },
    response_omitted: false,
    replay_valid: true,
    ...overrides,
  };
}

function conflictTx(record: ReturnType<typeof existingRecord> | null) {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(record ? [record] : []),
    $executeRaw: vi.fn(),
  };
}

describe("F03 idempotency replay identity and safety", () => {
  it.each([
    ["another actor", { actor_membership_id: "member-b" }],
    ["a legacy actor-less record", { actor_membership_id: null }],
    ["another operation with the same fingerprint", { scope: "DELETE /api/v1/action" }],
    ["a changed payload", { request_fingerprint: "different" }],
  ])("rejects %s without disclosing or repeating the result", async (_label, overrides) => {
    const handler = vi.fn();
    await expect(
      withIdempotency(conflictTx(existingRecord(overrides)), claim, handler),
    ).rejects.toMatchObject({ status: 422 });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["expired response", { replay_valid: false }],
    ["in-progress response", { status: "IN_PROGRESS" }],
    ["omitted response", { response_omitted: true }],
  ])("refuses an %s without repeating the operation", async (_label, overrides) => {
    const handler = vi.fn();
    await expect(
      withIdempotency(conflictTx(existingRecord(overrides)), claim, handler),
    ).rejects.toMatchObject({ status: 409 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("never executes without a claim when a conflicting row disappears", async () => {
    const handler = vi.fn();
    await expect(withIdempotency(conflictTx(null), claim, handler)).rejects.toMatchObject({
      status: 409,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(257), "é".repeat(129)])(
    "rejects invalid key %j before database work",
    async (key) => {
      const tx = conflictTx(existingRecord());
      await expect(
        withIdempotency(tx, { ...claim, idempotencyKey: key }, vi.fn()),
      ).rejects.toMatchObject({ status: 400 });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it("requires actor identity even for a fresh claim", async () => {
    const tx = conflictTx(existingRecord());
    await expect(
      withIdempotency(tx, { ...claim, actorMembershipId: "" }, vi.fn()),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("replays the original actor's identical valid request without calling the handler", async () => {
    const handler = vi.fn();
    await expect(withIdempotency(conflictTx(existingRecord()), claim, handler)).resolves.toEqual({
      privateResult: "member-a-result",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("stores a fresh result once", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "new-record" }]),
      $executeRaw: vi.fn(),
    };
    const handler = vi.fn().mockResolvedValue({ created: true });
    await expect(withIdempotency(tx, claim, handler)).resolves.toEqual({ created: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
});
