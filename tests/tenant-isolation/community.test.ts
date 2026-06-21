import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  listPostsInSpace,
  listSpaces,
} from "../../apps/web/src/server/community/community.service";
import { authoringTenantTx, createCommunityFixture } from "../fixtures/community-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const COMMUNITY_TABLES = [
  "community_spaces",
  "group_memberships",
  "posts",
  "comments",
  "reactions",
  "mentions",
] as const;

describeWithDb("community tenant isolation", () => {
  it("RLS filters all six community tables to current tenant", async () => {
    const fixture = await createCommunityFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into posts (
          id, tenant_id, space_id, author_membership_id, body_json, status, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${fixture.tenantId}::uuid,
          ${fixture.tenantSpaceId}::uuid,
          ${fixture.learnerMembershipId}::uuid,
          '{"version":1,"blocks":[{"type":"paragraph","children":[{"type":"text","text":"iso"}]}]}'::jsonb,
          'published',
          now(),
          now()
        )
      `;
    });

    for (const table of COMMUNITY_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );

      expect(rows).toHaveLength(0);
    }
  });

  it("does not expose tenant B community spaces to tenant A service reads", async () => {
    const fixture = await createCommunityFixture();
    const isolation = await createTenantIsolationFixture();

    const foreignSpaces = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
      listSpaces(tx, {
        tenantId: isolation.tenantA.tenantId,
        actorMembershipId: isolation.tenantA.membershipId,
        requestId: "iso_spaces",
      }),
    );

    expect(foreignSpaces.data.items.some((space) => space.id === fixture.tenantSpaceId)).toBe(
      false,
    );
  });

  it("denies cross-tenant post reads through service layer", async () => {
    const fixture = await createCommunityFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        listPostsInSpace(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "iso_posts",
          },
          fixture.tenantSpaceId,
        ),
      ),
    ).rejects.toThrow();
  });
});
