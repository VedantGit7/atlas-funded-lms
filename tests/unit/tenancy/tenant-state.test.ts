import { describe, expect, it } from "vitest";
import { assertTenantActive, assertTenantDomainActive } from "@atlas/tenancy";

describe("tenant state gates", () => {
  it("allows ACTIVE tenant", () => {
    expect(() => assertTenantActive("ACTIVE")).not.toThrow();
  });

  it.each(["PROVISIONING", "SUSPENDED", "ARCHIVED", "DELETED"] as const)(
    "blocks tenant state %s",
    (state) => {
      expect(() => assertTenantActive(state)).toThrow("Tenant unavailable");
    },
  );

  it("allows ACTIVE domain", () => {
    expect(() => assertTenantDomainActive("ACTIVE")).not.toThrow();
  });

  it.each(["PENDING", "VERIFYING", "FAILED", "REMOVED", "ERROR"] as const)(
    "blocks domain status %s",
    (status) => {
      expect(() => assertTenantDomainActive(status)).toThrow("Tenant not found");
    },
  );
});
