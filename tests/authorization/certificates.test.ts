import { describe, expect, it, vi } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";

function adminTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "certificate.issue" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "admin" }]),
  };
}

function instructorWithoutRelationshipTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "certificate.issue" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "instructor" }]),
  };
}

function learnerTx() {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ key: "certificate.read" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role_key: "learner" }]),
  };
}

describe("certificate authorization", () => {
  it("allows learner self certificate read", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "certificate.read",
      resource: createTenantResourceRef({
        type: "certificate",
        id: "cert-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-a",
        relationships: { selfCertificate: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_cert" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows learner to list the self-filtered certificate catalog", async () => {
    // Regression: the list endpoint (`GET /api/v1/certificates`) uses a
    // `certificate_catalog` resource that has no single certificate to relate to.
    // Its loader asserts `selfCertificate` for the actor so a learner can browse
    // their own wallet; per-row ownership stays enforced by the SQL query.
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "certificate.read",
      resource: createTenantResourceRef({
        type: "certificate_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: { selfCertificate: "learner-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_cert_catalog" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies certificate catalog read when no relationship is asserted", async () => {
    const decision = await can({
      tx: learnerTx(),
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "certificate.read",
      resource: createTenantResourceRef({
        type: "certificate_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_cert_catalog_denied" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies issue when relationship missing", async () => {
    const decision = await can({
      tx: instructorWithoutRelationshipTx(),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "certificate.issue",
      resource: createTenantResourceRef({
        type: "certificate_issue",
        id: "template-a",
        tenantId: "tenant-a",
        relationships: {},
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_issue" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("allows admin revoke without relationship", async () => {
    const decision = await can({
      tx: adminTx(),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "certificate.revoke",
      resource: createTenantResourceRef({
        type: "certificate",
        id: "cert-a",
        tenantId: "tenant-a",
        ownerMembershipId: "learner-b",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_revoke" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("honors explicit deny override", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ key: "certificate.read" }])
        .mockResolvedValueOnce([{ effect: "DENY" }]),
    };

    const decision = await can({
      tx,
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "certificate.read",
      resource: createTenantResourceRef({
        type: "certificate_catalog",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth_deny" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});
