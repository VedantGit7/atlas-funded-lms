import { describe, expect, it, vi } from "vitest";
import {
  createDeletionRequestBodySchema,
  exportJobDtoSchema,
  exportListQuerySchema,
  processDeletionRequestBodySchema,
} from "@atlas/domain/data-rights/data-rights.dto";
import {
  DATA_DELETION_PROCESSED_AUDIT,
  DATA_DELETION_REQUESTED_AUDIT,
  DATA_EXPORT_REQUESTED_AUDIT,
  dataExportRequestedPayloadSchema,
} from "@atlas/domain/data-rights/data-rights.events";
import {
  mapExportJobBaseDto,
  ensureExportEntitlement,
} from "@atlas/domain/data-rights/data-rights.service";

describe("data-rights schemas", () => {
  it("parses export list query with allow-listed status", () => {
    expect(exportListQuerySchema.parse({ status: "QUEUED", limit: 10 }).status).toBe("QUEUED");
  });

  it("rejects client tenant fields on deletion request body", () => {
    expect(() =>
      createDeletionRequestBodySchema.parse({ confirm: true, tenant_id: "bad" }),
    ).toThrow();
  });

  it("requires explicit confirmation for process body", () => {
    expect(() => processDeletionRequestBodySchema.parse({})).toThrow();
    expect(processDeletionRequestBodySchema.parse({ confirm: true }).confirm).toBe(true);
  });

  it("validates export worker payload schema version", () => {
    const payload = dataExportRequestedPayloadSchema.parse({
      exportJobId: "11111111-1111-4111-8111-111111111111",
      requestedAt: new Date().toISOString(),
      requestedByMembershipId: "22222222-2222-4222-8222-222222222222",
      schemaVersion: 1,
    });
    expect(payload.schemaVersion).toBe(1);
  });
});

describe("data-rights DTO mapping", () => {
  it("omits download and storage keys from export list DTO", () => {
    const dto = mapExportJobBaseDto({
      id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      requested_by_membership_id: "33333333-3333-4333-8333-333333333333",
      status: "QUEUED",
      scope_json: { version: 1, domains: ["membership"] },
      r2_object_key: "tenants/secret/export.json",
      error_json: null,
      expires_at: null,
      created_at: new Date("2025-01-01T00:00:00.000Z"),
      updated_at: new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(exportJobDtoSchema.omit({ download: true }).safeParse(dto).success).toBe(true);
    expect(JSON.stringify(dto)).not.toContain("r2_object_key");
    expect(JSON.stringify(dto)).not.toContain("secret");
  });

  it("uses approved audit constants", () => {
    expect(DATA_EXPORT_REQUESTED_AUDIT).toBe("data.export.requested");
    expect(DATA_DELETION_REQUESTED_AUDIT).toBe("data.deletion.requested");
    expect(DATA_DELETION_PROCESSED_AUDIT).toBe("data.deletion.processed");
  });
});

describe("entitlement-before-permission service guard", () => {
  it("throws entitlement required before export operations proceed", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([]),
    };

    await expect(
      ensureExportEntitlement(tx as never, {
        tenantId: "11111111-1111-4111-8111-111111111111",
        actorMembershipId: "22222222-2222-4222-8222-222222222222",
        requestId: "req_export_entitlement",
      }),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });
});
