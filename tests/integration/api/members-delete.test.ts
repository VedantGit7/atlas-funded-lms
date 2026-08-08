import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runProtectedTenantRouteHandler } from "@atlas/api";
import { assignDefaultLearnerRole } from "@atlas/access";
import { withTenantTx } from "@atlas/db";
import { removeMember, removeMemberResponseSchema } from "@atlas/membership";
import { deleteRouteMetadata } from "../../../backend/apps/api/src/app/api/v1/members/[id]/route.metadata";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("removeMember integration", () => {
  it("soft-removes an invited membership", async () => {
    const fixture = await createCourseAuthoringFixture();
    const invitedMembershipId = randomUUID();
    const ctx = adminCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into memberships (
          id,
          tenant_id,
          status,
          invited_email_normalized,
          created_at,
          updated_at
        )
        values (
          ${invitedMembershipId}::uuid,
          ${fixture.tenantId}::uuid,
          'INVITED',
          ${`invite-${invitedMembershipId.slice(0, 8)}@example.test`},
          now(),
          now()
        )
      `;

      await assignDefaultLearnerRole({
        tx,
        tenantId: fixture.tenantId,
        membershipId: invitedMembershipId,
        assignedByMembershipId: fixture.adminMembershipId,
      });
    });

    const removed = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => removeMember(tx, ctx, invitedMembershipId),
    );

    expect(removed.data.status).toBe("REMOVED");
    expect(removed.data.id).toBe(invitedMembershipId);
    expect(removed.data.removedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(() => removeMemberResponseSchema.parse(removed)).not.toThrow();
  });

  it("runs the delete route pipeline for an invited member", async () => {
    const fixture = await createCourseAuthoringFixture();
    const invitedMembershipId = randomUUID();
    const ctx = adminCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into memberships (
          id,
          tenant_id,
          status,
          invited_email_normalized,
          created_at,
          updated_at
        )
        values (
          ${invitedMembershipId}::uuid,
          ${fixture.tenantId}::uuid,
          'INVITED',
          ${`invite-${invitedMembershipId.slice(0, 8)}@example.test`},
          now(),
          now()
        )
      `;

      await assignDefaultLearnerRole({
        tx,
        tenantId: fixture.tenantId,
        membershipId: invitedMembershipId,
        assignedByMembershipId: fixture.adminMembershipId,
      });
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      const result = await runProtectedTenantRouteHandler({
        tx,
        ctx,
        metadata: deleteRouteMetadata,
        params: { id: invitedMembershipId },
        input: {},
        handler: async ({ tx: routeTx, ctx: routeCtx, params }) =>
          removeMember(routeTx, routeCtx, params.id!),
      });

      expect(result.data.status).toBe("REMOVED");
    });
  });
});
