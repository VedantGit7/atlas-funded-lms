import { describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@atlas/db";
import { reportDeliveryEffectsRepository as repository } from "@atlas/domain/reports/report-delivery-effects.repository";

function fixture(overrides: Record<string, unknown> = {}) {
  const row = {
    effect_key: "key",
    kind: "email",
    destination_id: null,
    request_json: { to: "a@example.com" },
    retry_on_crash: false,
    status: "processing",
    lease_until: new Date(0),
    error_kind: null,
    ...overrides,
  };
  const query = vi.fn(async (_sql: TemplateStringsArray, ..._values: unknown[]) => [row]);
  const execute = vi.fn(async (_sql: TemplateStringsArray, ..._values: unknown[]) => 1);
  return { tx: { $queryRaw: query, $executeRaw: execute } as unknown as TenantTx, execute, query };
}

describe("report delivery effect claims", () => {
  it("locks the receipt and commits reconciliation for expired SMTP claims", async () => {
    const { tx, query, execute } = fixture();
    expect(await repository.claim(tx, "key")).toEqual({ status: "reconciliation_required" });
    expect(query.mock.calls[0]?.[0].join("")).toContain("for update");
    expect(execute.mock.calls[0]?.[0].join("")).toContain("status = 'reconciliation_required'");
  });
  it("never resends a succeeded or reconciliation-required receipt", async () => {
    for (const status of ["succeeded", "reconciliation_required"]) {
      const { tx, execute } = fixture({ status });
      expect(await repository.claim(tx, "key")).toEqual({ status });
      expect(execute).not.toHaveBeenCalled();
    }
  });
  it("does not steal an unexpired claim", async () => {
    const { tx, execute } = fixture({ lease_until: new Date(Date.now() + 60_000) });
    expect(await repository.claim(tx, "key")).toEqual({ status: "busy" });
    expect(execute).not.toHaveBeenCalled();
  });
  it("reclaims an expired idempotent endpoint using the frozen request", async () => {
    const { tx } = fixture({ retry_on_crash: true, kind: "webhook" });
    const claim = await repository.claim(tx, "key");
    expect(claim).toMatchObject({
      status: "claimed",
      effect: { effectKey: "key", request: { to: "a@example.com" } },
    });
    expect(claim.leaseToken).toBeTruthy();
  });
  it("fences stale result writers with their claim token", async () => {
    const { tx, execute } = fixture();
    execute.mockResolvedValue(0);
    expect(await repository.finish(tx, "key", "stale-token", "succeeded", null, null)).toBe(false);
    const sql = execute.mock.calls[0]?.[0].join("");
    expect(sql).toContain("and lease_token =");
    expect(sql).toContain("and status = 'processing'");
  });
});
