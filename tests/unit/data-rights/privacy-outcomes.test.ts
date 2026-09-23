import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  processDeletionRequest,
  mapDeletionRequestDto,
} from "@atlas/domain/data-rights/data-rights.service";
import { dataRightsRepository } from "@atlas/domain/data-rights/data-rights.repository";
import { processDeletionRequestBodySchema } from "@atlas/domain/data-rights/data-rights.dto";
import {
  deletionRequestDtoSchema,
  exportJobDtoSchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import { spoolTenantExport } from "@atlas/domain/data-rights/export-spool";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), audit: vi.fn() }));
vi.mock("@atlas/membership", () => ({ removeMember: mocks.remove }));
vi.mock("@atlas/audit", () => ({ auditWriter: { write: mocks.audit } }));
const tenantId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const ctx = { tenantId, actorMembershipId: memberId, requestId: "request-test" };
const queued = {
  id: requestId,
  tenant_id: tenantId,
  requested_by_membership_id: memberId,
  target_type: "membership",
  target_id: memberId,
  status: "QUEUED" as const,
  reason: null,
  scheduled_at: null,
  completed_at: null,
  created_at: new Date("2026-09-20T00:00:00Z"),
  updated_at: new Date("2026-09-20T00:00:00Z"),
};
afterEach(() => {
  vi.restoreAllMocks();
  mocks.remove.mockReset();
  mocks.audit.mockReset();
});

describe("F14 explicit privacy outcomes", () => {
  it("preserves legacy request fingerprints and conservatively accepts cached responses", () => {
    expect(processDeletionRequestBodySchema.parse({ confirm: true })).toEqual({ confirm: true });
    const legacyDeletion = {
      id: requestId,
      status: "SUCCEEDED",
      targetType: "membership",
      targetId: memberId,
      requestedByMembershipId: memberId,
      reason: null,
      scheduledAt: null,
      completedAt: null,
      createdAt: queued.created_at.toISOString(),
      updatedAt: queued.updated_at.toISOString(),
    };
    expect(deletionRequestDtoSchema.parse(legacyDeletion)).toMatchObject({
      outcome: null,
      operation: "remove_school_access",
    });
    expect(
      exportJobDtoSchema.omit({ download: true }).parse({
        id: requestId,
        status: "SUCCEEDED",
        requestedByMembershipId: memberId,
        createdAt: queued.created_at.toISOString(),
        updatedAt: queued.updated_at.toISOString(),
        expiresAt: null,
        errorCode: null,
      }),
    ).toMatchObject({ scope: null, completePersonalDataExport: false });
  });
  it("never represents a historical success without evidence as completed erasure", () => {
    const dto = mapDeletionRequestDto({ ...queued, status: "SUCCEEDED" });
    expect(dto).toMatchObject({ operation: "remove_school_access", outcome: null });
    expect(dto.completionMessage).toContain("not verified");
  });

  it("rejects an erasure instruction rather than silently treating it as offboarding", () => {
    expect(
      processDeletionRequestBodySchema.safeParse({ confirm: true, operation: "erase_all_data" })
        .success,
    ).toBe(false);
    expect(
      processDeletionRequestBodySchema.parse({ confirm: true, operation: "remove_school_access" })
        .operation,
    ).toBe("remove_school_access");
  });

  it("records retained data and unchanged global identity in the same transaction as removal", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([queued]) };
    vi.spyOn(dataRightsRepository, "findDeletionRequestById").mockResolvedValue(queued);
    const complete = vi
      .spyOn(dataRightsRepository, "markDeletionRequestSucceeded")
      .mockImplementation(async (_tx, _id, outcome) => ({
        ...queued,
        status: "SUCCEEDED",
        outcome_json: outcome,
      }));
    const result = await processDeletionRequest(tx as never, ctx, requestId, { confirm: true });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(tx, ctx, memberId);
    expect(complete.mock.calls[0]?.[0]).toBe(tx);
    const outcome = complete.mock.calls[0]?.[2];
    expect(outcome).toMatchObject({
      version: 1,
      operation: "remove_school_access",
      accessRemoved: true,
      erasure: "not_performed",
      globalIdentity: "unchanged",
      retentionReviewRequired: true,
    });
    expect(outcome.retained.map((item: { category: string }) => item.category)).toEqual(
      expect.arrayContaining([
        "profile",
        "learning",
        "payments",
        "uploads_proctoring",
        "analytics_search",
        "providers",
        "backups",
      ]),
    );
    expect(result.data.outcome).toEqual(outcome);
    expect(mocks.audit.mock.calls[0]?.[2]?.after?.outcome).toEqual(outcome);
  });

  it("does not mark success or write a completion audit when access removal fails", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([queued]) };
    vi.spyOn(dataRightsRepository, "findDeletionRequestById").mockResolvedValue(queued);
    const complete = vi.spyOn(dataRightsRepository, "markDeletionRequestSucceeded");
    mocks.remove.mockRejectedValue(new Error("Removal failed"));
    await expect(
      processDeletionRequest(tx as never, ctx, requestId, { confirm: true }),
    ).rejects.toThrow("Removal failed");
    expect(complete).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects a request belonging to another tenant before removal", async () => {
    const foreign = { ...queued, tenant_id: "44444444-4444-4444-8444-444444444444" };
    const tx = { $queryRaw: vi.fn().mockResolvedValue([foreign]) };
    vi.spyOn(dataRightsRepository, "findDeletionRequestById").mockResolvedValue(foreign);
    await expect(
      processDeletionRequest(tx as never, ctx, requestId, { confirm: true }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("includes an explicit partial-scope manifest in generated tenant exports", async () => {
    const file = await spoolTenantExport(ctx, async () => []);
    try {
      const artifact = JSON.parse(await readFile(file.path, "utf8"));
      expect(artifact.coverage).toMatchObject({
        kind: "tenant_snapshot",
        completePersonalDataExport: false,
      });
      expect(artifact.coverage.includedFields.memberProfiles).toEqual([
        "membershipId",
        "displayName",
      ]);
      expect(artifact.coverage.excludedCategories).toContain("assessments_and_submissions");
      expect(artifact.memberships).toEqual([]);
    } finally {
      await file.cleanup();
    }
  });
});
