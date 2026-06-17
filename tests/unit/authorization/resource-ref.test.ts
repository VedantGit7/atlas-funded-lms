import { describe, expect, it } from "vitest";
import { assertTenantScopedResource, createTenantResourceRef } from "@atlas/authorization";

describe("resource ref", () => {
  it("creates tenant-scoped refs with optional ownership and relationships", () => {
    const resource = createTenantResourceRef({
      type: "member_profile",
      id: "profile-a",
      tenantId: "tenant-a",
      ownerMembershipId: "member-a",
      relationships: { enrolledInCourse: "member-a" },
    });

    expect(resource).toEqual({
      type: "member_profile",
      id: "profile-a",
      tenantId: "tenant-a",
      tenantScoped: true,
      ownerMembershipId: "member-a",
      relationships: { enrolledInCourse: "member-a" },
    });
  });

  it("rejects invalid resource refs at creation time", () => {
    expect(() =>
      createTenantResourceRef({
        type: "",
        id: "profile-a",
        tenantId: "tenant-a",
      }),
    ).toThrow("Invalid ResourceRef");
  });

  it("asserts tenant alignment for scoped resources", () => {
    const resource = createTenantResourceRef({
      type: "course",
      id: "course-a",
      tenantId: "tenant-a",
    });

    expect(() =>
      assertTenantScopedResource({
        resource,
        tenantId: "tenant-a",
      }),
    ).not.toThrow();

    expect(() =>
      assertTenantScopedResource({
        resource,
        tenantId: "tenant-b",
      }),
    ).toThrow("TENANT_MISMATCH");
  });
});
