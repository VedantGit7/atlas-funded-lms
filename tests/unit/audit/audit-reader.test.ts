import { describe, expect, it, vi } from "vitest";
import { readTenantAuditLog } from "@atlas/audit/services/audit-reader.service";
import { listTenantAuditEntries } from "@atlas/audit/repositories/audit.repository";

vi.mock("@atlas/audit/repositories/audit.repository", () => ({
  listTenantAuditEntries: vi.fn(),
}));

const listTenantAuditEntriesMock = vi.mocked(listTenantAuditEntries);

describe("readTenantAuditLog", () => {
  it("returns cursor pagination metadata from repository rows", async () => {
    const tx = { $queryRaw: vi.fn() };
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `018f0000-0000-7000-8000-00000000000${index}`,
      occurred_at: new Date(`2025-01-0${index + 1}T00:00:00.000Z`),
      action: "member.invited",
      target_type: "membership",
      target_id: "018f0000-0000-7000-8000-000000000099",
      actor_membership_id: "018f0000-0000-7000-8000-000000000088",
      actor_principal_id: null,
      request_id: "req-1",
      reason: null,
      metadata_json: null,
    }));

    listTenantAuditEntriesMock.mockResolvedValue(rows);

    const response = await readTenantAuditLog(tx, { limit: 2 });

    expect(listTenantAuditEntriesMock).toHaveBeenCalledWith(tx, { limit: 2 });
    expect(response.data).toHaveLength(2);
    expect(response.page.hasMore).toBe(true);
    expect(response.page.nextCursor).toBe(
      Buffer.from(
        JSON.stringify({
          occurredAt: rows[1].occurred_at.toISOString(),
          id: rows[1].id,
        }),
      ).toString("base64url"),
    );
  });

  it("passes cursor query params through to the repository", async () => {
    const tx = { $queryRaw: vi.fn() };
    const cursor = Buffer.from(
      JSON.stringify({
        occurredAt: "2025-01-01T00:00:00.000Z",
        id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toString("base64url");

    listTenantAuditEntriesMock.mockResolvedValue([]);

    await readTenantAuditLog(tx, { limit: 25, cursor });

    expect(listTenantAuditEntriesMock).toHaveBeenCalledWith(tx, { limit: 25, cursor });
  });
});
