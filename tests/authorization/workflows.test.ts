import { describe, expect, it } from "vitest";
import { can, createTenantResourceRef } from "@atlas/authorization";
import { authorizationFactsQuery } from "../helpers/authorization-facts";

function workflowTransitionTx(roleKeys: string[]) {
  return {
    $queryRaw: authorizationFactsQuery(
      [{ key: "workflow.transition.act" }],
      [],
      roleKeys.map((role_key) => ({
        role_key,
        bypasses_resource_predicates: role_key === "owner" || role_key === "admin",
      })),
    ),
  };
}

describe("workflow authorization", () => {
  it("denies learner workflow.transition.act", async () => {
    const decision = await can({
      tx: {
        $queryRaw: authorizationFactsQuery([{ key: "workflow.transition.act" }], [], []),
      },
      actor: { tenantId: "tenant-a", membershipId: "learner-a" },
      permission: "workflow.transition.act",
      resource: createTenantResourceRef({
        type: "workflow_queue",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NO_ROLE_GRANT");
  });

  it("allows admin to act on course workflow transition", async () => {
    const decision = await can({
      tx: workflowTransitionTx(["admin"]),
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "workflow.transition.act",
      resource: createTenantResourceRef({
        type: "workflow_transition",
        id: "transition-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
        relationships: { instructorOfCourse: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies instructor approving own submitted course workflow", async () => {
    const decision = await can({
      tx: workflowTransitionTx(["instructor"]),
      actor: { tenantId: "tenant-a", membershipId: "instructor-a" },
      permission: "workflow.transition.act",
      resource: createTenantResourceRef({
        type: "workflow_transition",
        id: "transition-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
        relationships: { instructorOfCourse: "instructor-a" },
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("denies moderator acting on course workflow without moderation relationship", async () => {
    const decision = await can({
      tx: workflowTransitionTx(["moderator"]),
      actor: { tenantId: "tenant-a", membershipId: "moderator-a" },
      permission: "workflow.transition.act",
      resource: createTenantResourceRef({
        type: "workflow_transition",
        id: "transition-a",
        tenantId: "tenant-a",
        ownerMembershipId: "instructor-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("RELATIONSHIP_REQUIRED");
  });

  it("blocks workflow.transition.act when explicit deny override exists", async () => {
    const decision = await can({
      tx: {
        $queryRaw: authorizationFactsQuery(
          [{ key: "workflow.transition.act" }],
          [{ effect: "DENY" }],
          [{ role_key: "admin", bypasses_resource_predicates: true }],
        ),
      },
      actor: { tenantId: "tenant-a", membershipId: "admin-a" },
      permission: "workflow.transition.act",
      resource: createTenantResourceRef({
        type: "workflow_queue",
        id: "tenant-a",
        tenantId: "tenant-a",
      }),
      ctx: { tenantId: "tenant-a", requestId: "req_auth" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("EXPLICIT_DENY");
  });
});
