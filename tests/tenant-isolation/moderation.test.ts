import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { listModerationCases } from "../../backend/apps/api/src/server/moderation/moderation.service";
import { authoringTenantTx, createCommunityFixture } from "../fixtures/community-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const MODERATION_TABLES = ["moderation_cases", "moderation_decisions", "appeals"] as const;

describeWithDb("moderation tenant isolation", () => {
  it("RLS filters moderation tables to current tenant", async () => {
    const fixture = await createCommunityFixture();
    const isolation = await createTenantIsolationFixture();
    const caseId = randomUUID();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into moderation_cases (
          id, tenant_id, target_type, target_id, status, created_at, updated_at
        )
        values (
          ${caseId}::uuid,
          ${fixture.tenantId}::uuid,
          'post',
          ${randomUUID()}::uuid,
          'OPEN'::"ModerationStatus",
          now(),
          now()
        )
      `;
    });

    for (const table of MODERATION_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );

      expect(rows).toHaveLength(0);
    }
  });

  it("does not expose tenant B moderation cases to tenant A service reads", async () => {
    const fixture = await createCommunityFixture();
    const isolation = await createTenantIsolationFixture();
    const caseId = randomUUID();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into moderation_cases (
          id, tenant_id, target_type, target_id, status, created_at, updated_at
        )
        values (
          ${caseId}::uuid,
          ${fixture.tenantId}::uuid,
          'post',
          ${randomUUID()}::uuid,
          'OPEN'::"ModerationStatus",
          now(),
          now()
        )
      `;
    });

    const list = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
      listModerationCases(
        tx,
        {
          tenantId: isolation.tenantA.tenantId,
          actorMembershipId: isolation.tenantA.membershipId,
          requestId: "iso_mod",
        },
        { view: "cases", limit: 25 },
      ),
    );

    expect(list.data.items.some((item) => item.id === caseId)).toBe(false);
  });
});
