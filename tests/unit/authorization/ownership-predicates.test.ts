import { describe, expect, it } from "vitest";
import {
  actorOwnsResource,
  createTenantResourceRef,
  requiresOwnership,
} from "@atlas/authorization";

describe("ownership predicates", () => {
  it("marks owner-bound permissions and .self suffix permissions", () => {
    expect(requiresOwnership("profile.update")).toBe(true);
    expect(requiresOwnership("notification.read.self")).toBe(true);
    expect(requiresOwnership("membership.read")).toBe(false);
  });

  it("matches actor membership to resource owner membership id", () => {
    const resource = createTenantResourceRef({
      type: "member_profile",
      id: "profile-a",
      tenantId: "tenant-a",
      ownerMembershipId: "member-a",
    });

    expect(
      actorOwnsResource({
        actor: { tenantId: "tenant-a", membershipId: "member-a" },
        resource,
      }),
    ).toBe(true);

    expect(
      actorOwnsResource({
        actor: { tenantId: "tenant-a", membershipId: "member-b" },
        resource,
      }),
    ).toBe(false);
  });
});
