import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { captureDeviceSessionMetadata } from "@atlas/domain/devices/devices.route-metadata";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

// Launch plan 5.1 (staging, 6 November 2026): every page load posted the
// member's device session and learners got 403, because the route checked
// `profile.update` against the tenant instead of the member's own profile.
const ctx = { tenantId: "tenant-a", actorMembershipId: "member-a", requestId: "req_test" };

function learnerFacts(permissions: string[]) {
  return {
    $queryRaw: authorizationFactsQuery(
      permissions.map((key) => ({ key })),
      [],
      [{ role_key: "learner", bypasses_resource_predicates: false }],
    ),
  };
}

describe("device session capture authorization", () => {
  it("lets a learner record their own device session", async () => {
    const resource = await captureDeviceSessionMetadata.resourceLoader({ ctx });

    const decision = await can({
      tx: learnerFacts(["profile.update"]),
      actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
      permission: captureDeviceSessionMetadata.permission,
      resource,
      ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
    });

    expect(decision.allowed).toBe(true);
  });

  it("checks the actor's own profile, so it can't be pointed at another member", async () => {
    const resource = await captureDeviceSessionMetadata.resourceLoader({ ctx });
    expect(resource).toMatchObject({
      type: "member_profile",
      id: ctx.actorMembershipId,
      ownerMembershipId: ctx.actorMembershipId,
    });

    const someoneElse = createTenantResourceRef({
      type: "member_profile",
      id: "member-b",
      tenantId: ctx.tenantId,
      ownerMembershipId: "member-b",
    });
    const decision = await can({
      tx: learnerFacts(["profile.update"]),
      actor: { tenantId: ctx.tenantId, membershipId: ctx.actorMembershipId },
      permission: "profile.update",
      resource: someoneElse,
      ctx: { tenantId: ctx.tenantId, requestId: ctx.requestId },
    });
    expect(decision.allowed).toBe(false);
  });
});
