import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuditWrite } = vi.hoisted(() => ({ mockAuditWrite: vi.fn() }));

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: (...args: unknown[]) => mockAuditWrite(...args) },
}));

import { ensureMutationAudited } from "../../../backend/packages/api/src/mutation-audit";

/** Audit M7: audit: "required" is enforced, not just declared. */
describe("ensureMutationAudited", () => {
  const ctx = {
    tenantId: "018f0000-0000-7000-8000-000000000001",
    actorMembershipId: "018f0000-0000-7000-8000-000000000020",
    requestId: "req-m7",
  };
  const resource = {
    type: "item",
    id: "018f0000-0000-7000-8000-0000000000a1",
    tenantId: ctx.tenantId,
    tenantScoped: true as const,
  };
  const required = {
    permission: "item.update",
    audit: "required" as const,
    rateLimit: "tenantMutation",
    idempotency: "required" as const,
  };

  function txWith(written: string | null) {
    const queryRaw = vi.fn(async () => [{ written }]);
    return { tx: { $queryRaw: queryRaw } as never, queryRaw };
  }

  beforeEach(() => {
    mockAuditWrite.mockReset();
    mockAuditWrite.mockResolvedValue({ id: "audit-1" });
  });

  it("leaves a mutation alone when the handler wrote its own entry", async () => {
    const { tx } = txWith("on");
    await ensureMutationAudited(tx, {
      ctx,
      metadata: required,
      method: "PUT",
      route: "/api/v1/items/x",
      resource,
    });
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });

  it("records a mutation the handler left off the record", async () => {
    const { tx } = txWith(null);
    await ensureMutationAudited(tx, {
      ctx,
      metadata: required,
      method: "PUT",
      route: "/api/v1/items/x",
      resource,
    });

    expect(mockAuditWrite).toHaveBeenCalledOnce();
    const [, actor, entry] = mockAuditWrite.mock.calls[0] ?? [];
    expect(actor).toMatchObject({
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: "req-m7",
    });
    expect(entry).toMatchObject({
      action: "api.mutation",
      target: { type: "item", id: resource.id },
      metadata: {
        permission: "item.update",
        method: "PUT",
        route: "/api/v1/items/x",
        recordedBy: "route_wrapper",
      },
    });
  });

  it("keeps a non-uuid resource key in metadata rather than the target id", async () => {
    const { tx } = txWith(null);
    await ensureMutationAudited(tx, {
      ctx,
      metadata: required,
      method: "PUT",
      route: "/api/v1/locales/fr",
      resource: { ...resource, type: "locale", id: "fr" },
    });
    expect(mockAuditWrite.mock.calls[0]?.[2]).toMatchObject({
      target: { type: "locale", id: null },
      metadata: { resourceKey: "fr" },
    });
  });

  it("does nothing for reads or for routes that do not require audit", async () => {
    const { tx, queryRaw } = txWith(null);
    await ensureMutationAudited(tx, {
      ctx,
      metadata: required,
      method: "GET",
      route: "/api/v1/items",
      resource,
    });
    await ensureMutationAudited(tx, {
      ctx,
      metadata: { ...required, audit: "none", auditExempt: "learner_activity" },
      method: "POST",
      route: "/api/v1/attempts/x/answers",
      resource,
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });
});
