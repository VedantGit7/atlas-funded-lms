import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { itemRegistryService } from "../../backend/apps/api/src/server/item-registry/item-registry.service";
import {
  authoringTenantTx,
  createItemRegistryFixture,
  instructorCtx,
  otherInstructorCtx,
} from "../fixtures/item-registry-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";
import { seedTenantForItemRegistry } from "../fixtures/item-registry-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("item registry tenant isolation", () => {
  it("Tenant A cannot read Tenant B item", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.getItem(tx, tenantB.itemId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot update Tenant B item", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.updateItem(tx, instructorCtx(tenantA), tenantB.itemId, {
          contentJson: { stem: "Hijacked" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("instructor cannot update another instructor item", async () => {
    const fixture = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.otherInstructorMembershipId), async (tx) =>
        itemRegistryService.updateItem(tx, otherInstructorCtx(fixture), fixture.itemId, {
          contentJson: { stem: "Not allowed" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot add Tenant B item to collection", async () => {
    const tenantA = await createItemRegistryFixture();
    const tenantB = await createItemRegistryFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        itemRegistryService.addItemToCollection(tx, instructorCtx(tenantA), tenantA.collectionId, {
          itemId: tenantB.itemId,
          position: 1,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("RLS blocks direct cross-tenant item read", async () => {
    const isolation = await createTenantIsolationFixture();
    await seedTenantForItemRegistry(isolation.tenantA.tenantId);
    await seedTenantForItemRegistry(isolation.tenantB.tenantId);

    const itemId = randomUUID();

    await withTenantTx(tenantCtx(isolation.tenantB), async (tx) => {
      await tx.$executeRaw`
        insert into items (
          id,
          tenant_id,
          item_type_key,
          stem_json,
          status,
          tags,
          created_by_membership_id,
          created_at,
          updated_at
        )
        values (
          ${itemId}::uuid,
          ${isolation.tenantB.tenantId}::uuid,
          'swipe',
          ${JSON.stringify({ stem: "Tenant B item" })}::jsonb,
          'DRAFT',
          '{}'::text[],
          ${isolation.tenantB.membershipId}::uuid,
          now(),
          now()
        )
      `;
    });

    await withTenantTx(tenantCtx(isolation.tenantA), async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        select id::text from items where id = ${itemId}::uuid
      `;
      expect(rows).toHaveLength(0);
    });
  });
});
